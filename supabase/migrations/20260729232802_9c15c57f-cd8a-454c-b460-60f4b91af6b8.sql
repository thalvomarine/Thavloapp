-- ============ B) verified_providers ============
CREATE TABLE public.verified_providers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid,
  notes text
);

GRANT SELECT ON public.verified_providers TO authenticated;
GRANT ALL ON public.verified_providers TO service_role;

ALTER TABLE public.verified_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verified_providers: read own or admin"
  ON public.verified_providers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verified_providers: admin insert"
  ON public.verified_providers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verified_providers: admin update"
  ON public.verified_providers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "verified_providers: admin delete"
  ON public.verified_providers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Grandfather existing providers (insert only)
INSERT INTO public.verified_providers (user_id, notes)
SELECT pd.id, 'Grandfathered from provider_details (Pass A.1)'
FROM public.provider_details pd
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_verified_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.verified_providers vp WHERE vp.user_id = _user_id)
$$;

REVOKE ALL ON FUNCTION public.is_verified_provider(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_verified_provider(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_verified_provider(uuid) TO authenticated, service_role;

-- Collapse to a single INSERT policy on job_offers
DROP POLICY IF EXISTS "offers: providers insert on open jobs (role)" ON public.job_offers;
DROP POLICY IF EXISTS "offers: provider inserts own" ON public.job_offers;

CREATE POLICY "offers: provider inserts own"
  ON public.job_offers FOR INSERT TO authenticated
  WITH CHECK (
    provider_id = auth.uid()
    AND public.is_verified_provider(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.provider_details pd ON pd.id = auth.uid()
      WHERE j.id = job_offers.job_id
        AND j.status = 'Pending'::public.job_status
        AND j.service_type = pd.service_type
    )
  );

-- ============ C) INSERT-side role escalation ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_role public.user_role NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _requested public.user_role;
begin
  begin
    _requested := nullif(new.raw_user_meta_data->>'role','')::public.user_role;
  exception when others then
    _requested := null;
  end;

  insert into public.profiles (
    id, full_name, boat_name, role, requested_role,
    preferred_language, phone, account_type
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'boat_name',
    'Client'::public.user_role,
    case when _requested = 'Client'::public.user_role then null else _requested end,
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'account_type','')
  );
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.prevent_profile_insert_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.role := 'Client'::public.user_role;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_prevent_insert_priv_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_insert_priv_escalation
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_insert_privilege_escalation();

CREATE OR REPLACE FUNCTION public.approve_role_request(_user_id uuid, _role public.user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.profiles
    SET role = _role, requested_role = NULL
    WHERE id = _user_id;

  IF _role = 'Provider'::public.user_role THEN
    INSERT INTO public.verified_providers (user_id, verified_by, notes)
      VALUES (_user_id, auth.uid(), 'Approved via approve_role_request')
      ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role = 'Supplier'::public.user_role THEN
    INSERT INTO public.verified_dealers (user_id, verified_by, note)
      VALUES (_user_id, auth.uid(), 'Approved via approve_role_request')
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.approve_role_request(uuid, public.user_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_role_request(uuid, public.user_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_role_request(uuid, public.user_role) TO authenticated, service_role;

-- ============ D) complete_job returns jsonb ============
DROP FUNCTION IF EXISTS public.complete_job(uuid);

CREATE FUNCTION public.complete_job(_job_id uuid)
RETURNS jsonb
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
  _commission_id uuid;
BEGIN
  SELECT total_escrow_pool, provider_id INTO total, prov
    FROM public.jobs
    WHERE id = _job_id
      AND client_id = auth.uid()
      AND status NOT IN ('Completed', 'Cancelled')
    FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.jobs WHERE id = _job_id AND client_id = auth.uid()) THEN
      RETURN jsonb_build_object('status', 'already_completed', 'job_id', _job_id);
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
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO _commission_id;

  IF _commission_id IS NULL THEN
    SELECT id INTO _commission_id FROM public.commission_records WHERE job_id = _job_id;
  END IF;

  IF prov IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.provider_payouts WHERE job_id = _job_id
  ) THEN
    INSERT INTO public.provider_payouts(
      provider_id, job_id, payment_intent_id, amount_cents, currency, status
    ) VALUES (prov, _job_id, _intent_id, _net, 'TRY', 'pending');
  END IF;

  RETURN jsonb_build_object(
    'status', 'completed',
    'job_id', _job_id,
    'commission_id', _commission_id
  );
END $$;

REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_job(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated, service_role;

-- ============ E) public catalog guard ============
DROP POLICY IF EXISTS parts_read_anon ON public.parts_catalog;
CREATE POLICY parts_read_anon
  ON public.parts_catalog FOR SELECT TO anon
  USING (active = true AND supplier_id IS NOT NULL);