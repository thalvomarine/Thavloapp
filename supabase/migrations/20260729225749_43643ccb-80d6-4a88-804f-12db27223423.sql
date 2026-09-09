-- 1. Remove duplicate commission rows produced by the non-idempotent complete_job
DELETE FROM public.commission_records cr
USING (
  SELECT id, row_number() OVER (PARTITION BY job_id ORDER BY created_at, id) AS rn
  FROM public.commission_records
) d
WHERE cr.id = d.id AND d.rn > 1;

ALTER TABLE public.commission_records
  ADD CONSTRAINT commission_records_job_id_unique UNIQUE (job_id);

-- 2. Idempotency for secured payment intents
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_one_secured_per_job
  ON public.payment_intents (job_id)
  WHERE status = 'secured';

-- 3. Sane bounds for extra parts
ALTER TABLE public.job_parts
  ADD CONSTRAINT job_parts_price_sane CHECK (part_price > 0 AND part_price <= 1000000);

-- 4. complete_job: idempotent, status-guarded
CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total numeric;
  commission numeric;
  payout numeric;
  prov uuid;
  _gross bigint;
  _fee bigint;
  _net bigint;
  _intent_id uuid;
BEGIN
  -- Lock the row and require a non-terminal status. This is the idempotency
  -- guard: a second call finds no row and exits without crediting again.
  SELECT total_escrow_pool, provider_id INTO total, prov
    FROM public.jobs
    WHERE id = _job_id
      AND client_id = auth.uid()
      AND status NOT IN ('Completed', 'Cancelled')
    FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id AND client_id = auth.uid()) THEN
      RETURN; -- already completed/cancelled: no-op, not an error
    END IF;
    RAISE EXCEPTION 'Not authorized';
  END IF;

  commission := round(total * 0.10);
  payout := total - commission;

  UPDATE public.jobs SET status = 'Completed' WHERE id = _job_id;

  PERFORM set_config('thalvo.internal_wallet_credit', 'on', true);
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  PERFORM set_config('thalvo.internal_wallet_credit', 'off', true);

  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  _gross := (round(total * 100))::bigint;
  _fee   := (round(commission * 100))::bigint;
  _net   := _gross - _fee;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured'
    ORDER BY created_at DESC LIMIT 1;

  IF _intent_id IS NOT NULL THEN
    UPDATE public.payment_intents
      SET status = 'released', released_at = now(), amount_cents = _gross
      WHERE id = _intent_id;

    INSERT INTO public.escrow_transactions(
      job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
    ) VALUES (
      _job_id, _intent_id, 'release', _gross, 'TRY', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'TRY')
  ON CONFLICT (job_id) DO NOTHING;

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id, amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;
END $function$;

-- 5. accept_offer: status-guarded
CREATE OR REPLACE FUNCTION public.accept_offer(_job_id uuid, _offer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare o public.job_offers%rowtype;
begin
  select * into o from public.job_offers where id = _offer_id and job_id = _job_id;
  if not found then raise exception 'Offer not found'; end if;
  update public.jobs
    set provider_id = o.provider_id,
        initial_labor_cost = o.price,
        total_escrow_pool = o.price,
        eta_minutes = o.eta_minutes,
        status = 'Accepted'
    where id = _job_id
      and client_id = auth.uid()
      and status in ('Pending', 'Offered');
  if not found then raise exception 'Not authorized'; end if;
end $function$;

-- 6. record_payment_intent: reuse an existing secured intent instead of duplicating
CREATE OR REPLACE FUNCTION public.record_payment_intent(_job_id uuid, _offer_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job public.jobs%ROWTYPE;
  _offer public.job_offers%ROWTYPE;
  _amount bigint;
  _intent_id uuid;
BEGIN
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR _job.client_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id INTO _intent_id FROM public.payment_intents
    WHERE job_id = _job_id AND status = 'secured' LIMIT 1;
  IF _intent_id IS NOT NULL THEN
    RETURN _intent_id;
  END IF;

  SELECT * INTO _offer FROM public.job_offers WHERE id = _offer_id AND job_id = _job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'offer missing'; END IF;

  _amount := (round(_offer.price * 100))::bigint;

  INSERT INTO public.payment_intents(
    job_id, offer_id, captain_id, provider_id,
    amount_cents, currency, status, provider, secured_at
  ) VALUES (
    _job_id, _offer_id, _job.client_id, _offer.provider_id,
    _amount, 'TRY', 'secured', 'simulated', now()
  )
  RETURNING id INTO _intent_id;

  INSERT INTO public.escrow_transactions(
    job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
  ) VALUES (
    _job_id, _intent_id, 'secure', _amount, 'TRY', auth.uid(),
    'Simulated funding — payment provider not yet connected'
  );

  RETURN _intent_id;
END $function$;