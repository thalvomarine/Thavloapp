
-- ============================================================
-- M9 · Payment / Escrow architecture v1
-- ============================================================

-- ----- payment_intents -----
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  offer_id uuid REFERENCES public.job_offers(id) ON DELETE SET NULL,
  captain_id uuid NOT NULL,
  provider_id uuid,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','pending','secured','released','refunded','failed')),
  provider text NOT NULL DEFAULT 'simulated',
  external_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  secured_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_intents_job_idx      ON public.payment_intents(job_id);
CREATE INDEX payment_intents_captain_idx  ON public.payment_intents(captain_id);
CREATE INDEX payment_intents_provider_idx ON public.payment_intents(provider_id);
CREATE INDEX payment_intents_status_idx   ON public.payment_intents(status);

GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL    ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pi captain read"  ON public.payment_intents FOR SELECT TO authenticated USING (captain_id = auth.uid());
CREATE POLICY "pi provider read" ON public.payment_intents FOR SELECT TO authenticated USING (provider_id = auth.uid());
CREATE POLICY "pi admin read"    ON public.payment_intents FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER payment_intents_set_updated_at BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- escrow_transactions -----
CREATE TABLE public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  kind text NOT NULL
    CHECK (kind IN ('secure','release','refund','extra_secure','extra_release')),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  actor_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX escrow_tx_job_idx    ON public.escrow_transactions(job_id);
CREATE INDEX escrow_tx_kind_idx   ON public.escrow_transactions(kind);

GRANT SELECT ON public.escrow_transactions TO authenticated;
GRANT ALL    ON public.escrow_transactions TO service_role;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etx captain read"  ON public.escrow_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = escrow_transactions.job_id AND j.client_id = auth.uid()));
CREATE POLICY "etx provider read" ON public.escrow_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = escrow_transactions.job_id AND j.provider_id = auth.uid()));
CREATE POLICY "etx admin read"    ON public.escrow_transactions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ----- provider_payouts -----
CREATE TABLE public.provider_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  external_ref text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_payouts_provider_idx ON public.provider_payouts(provider_id);
CREATE INDEX provider_payouts_job_idx      ON public.provider_payouts(job_id);
CREATE INDEX provider_payouts_status_idx   ON public.provider_payouts(status);

GRANT SELECT ON public.provider_payouts TO authenticated;
GRANT ALL    ON public.provider_payouts TO service_role;
ALTER TABLE public.provider_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payout provider read" ON public.provider_payouts FOR SELECT TO authenticated USING (provider_id = auth.uid());
CREATE POLICY "payout captain read"  ON public.provider_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = provider_payouts.job_id AND j.client_id = auth.uid()));
CREATE POLICY "payout admin read"    ON public.provider_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER provider_payouts_set_updated_at BEFORE UPDATE ON public.provider_payouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ----- commission_records -----
CREATE TABLE public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  gross_cents bigint NOT NULL,
  fee_cents bigint NOT NULL,
  net_cents bigint NOT NULL,
  rate numeric(5,4) NOT NULL DEFAULT 0.1000,
  currency text NOT NULL DEFAULT 'EUR',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_records_job_idx ON public.commission_records(job_id);

GRANT SELECT ON public.commission_records TO authenticated;
GRANT ALL    ON public.commission_records TO service_role;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission captain read" ON public.commission_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = commission_records.job_id AND j.client_id = auth.uid()));
CREATE POLICY "commission provider read" ON public.commission_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = commission_records.job_id AND j.provider_id = auth.uid()));
CREATE POLICY "commission admin read"   ON public.commission_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- Helper RPC · record_payment_intent
-- Called by the captain AFTER accept_offer runs.
-- Simulated mode: marks the intent 'secured' immediately.
-- TODO(payments-provider): swap to 'pending' and finalize via
--   provider webhook (Stripe Connect / iyzico / PayTR).
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_payment_intent(_job_id uuid, _offer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    _amount, 'EUR', 'secured', 'simulated', now()
  )
  RETURNING id INTO _intent_id;

  INSERT INTO public.escrow_transactions(
    job_id, payment_intent_id, kind, amount_cents, currency, actor_id, notes
  ) VALUES (
    _job_id, _intent_id, 'secure', _amount, 'EUR', auth.uid(),
    'Simulated funding — payment provider not yet connected'
  );

  RETURN _intent_id;
END $$;

REVOKE ALL ON FUNCTION public.record_payment_intent(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment_intent(uuid, uuid) TO authenticated;

-- ============================================================
-- Upgrade complete_job to also write commission + payout rows.
-- Keeps platform_ledger insert for backward compatibility.
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  UPDATE public.profiles SET wallet_balance = wallet_balance + payout WHERE id = prov;
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (_job_id, commission, payout);

  -- M9 payment/escrow lifecycle ---------------------------------
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
    -- TODO(payments-provider): trigger real payout job (Stripe Connect transfer,
    -- iyzico settlement, PayTR withdrawal) and mark status='completed' via webhook.
  END IF;
END $$;
