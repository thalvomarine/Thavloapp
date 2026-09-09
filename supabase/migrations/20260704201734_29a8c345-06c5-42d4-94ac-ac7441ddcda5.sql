CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    IF current_setting('thalvo.internal_wallet_credit', true) <> 'on' THEN
      RAISE EXCEPTION 'Not allowed to change wallet_balance';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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

  -- Transaction-scoped internal flag: lets prevent_profile_privilege_escalation
  -- allow the wallet_balance credit that only this RPC is supposed to make.
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
      _job_id, _intent_id, 'release', _gross, 'EUR', auth.uid(),
      'Captain confirmed mission completion'
    );
  END IF;

  INSERT INTO public.commission_records(
    job_id, payment_intent_id, gross_cents, fee_cents, net_cents, rate, currency
  ) VALUES (_job_id, _intent_id, _gross, _fee, _net, 0.10, 'EUR');

  IF prov IS NOT NULL THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id,
      amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'EUR', 'pending');
  END IF;
END $function$;