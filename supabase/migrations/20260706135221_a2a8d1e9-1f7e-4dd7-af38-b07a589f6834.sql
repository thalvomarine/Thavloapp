
UPDATE public.payment_intents SET currency='TRY' WHERE currency='EUR';
UPDATE public.escrow_transactions SET currency='TRY' WHERE currency='EUR';
UPDATE public.commission_records SET currency='TRY' WHERE currency='EUR';
UPDATE public.provider_payouts SET currency='TRY' WHERE currency='EUR';

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
  SELECT total_escrow_pool, provider_id INTO total, prov FROM public.jobs
    WHERE id = _job_id AND client_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

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
      SET status = 'released', released_at = now(),
          amount_cents = _gross
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
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'TRY');

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id,
      amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;
END $function$;
