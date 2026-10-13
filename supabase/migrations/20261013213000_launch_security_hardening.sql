-- Launch security hardening (public open).
-- Live DB: profiles.role and user_roles.role are text — compare/assign via ::text.
-- 1) Stop signup auto-verify / auto-privilege for dealer+provider
-- 2) Disable ensure_superadmin bootstrap; seed operator admin once
-- 3) claim_open_job requires is_verified_provider
-- 4) job_parts.payment_status only via approve/reject RPCs
-- 5) boatshow lead insert rate + length guards

-- ---------------------------------------------------------------------------
-- 1. Signup: always Client; store requested_role; never touch verified_*
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested public.user_role;
BEGIN
  BEGIN
    _requested := nullif(new.raw_user_meta_data->>'role', '')::public.user_role;
  EXCEPTION WHEN others THEN
    _requested := NULL;
  END;

  IF _requested IS NULL OR _requested = 'Client'::public.user_role THEN
    _requested := NULL;
  ELSIF _requested NOT IN ('Supplier'::public.user_role, 'Provider'::public.user_role) THEN
    _requested := NULL;
  END IF;

  PERFORM set_config('thalvo.signup_role', '1', true);

  INSERT INTO public.profiles (
    id, full_name, boat_name, role, requested_role,
    preferred_language, account_type, business_name, home_marina
  ) VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'boat_name',
    'Client',
    _requested,
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'account_type', ''),
    nullif(new.raw_user_meta_data->>'business_name', ''),
    nullif(new.raw_user_meta_data->>'home_marina', '')
  );

  INSERT INTO public.profile_contacts (id, phone)
  VALUES (new.id, nullif(new.raw_user_meta_data->>'phone', ''))
  ON CONFLICT (id) DO UPDATE
    SET phone = excluded.phone, updated_at = now();

  RETURN new;
END;
$$;

-- claim_signup_role: sync requested_role only — never promote or verify
CREATE OR REPLACE FUNCTION public.claim_signup_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_text text;
  _current public.user_role;
  _requested public.user_role;
  _meta public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT p.role::text, p.requested_role
    INTO _current_text, _requested
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF _current_text IS NULL THEN
    RETURN 'Client'::public.user_role;
  END IF;

  BEGIN
    _current := _current_text::public.user_role;
  EXCEPTION WHEN others THEN
    _current := 'Client'::public.user_role;
  END;

  IF _requested IS NULL THEN
    BEGIN
      _meta := nullif(
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        ''
      )::public.user_role;
    EXCEPTION WHEN others THEN
      _meta := NULL;
    END;

    IF _meta IN ('Supplier'::public.user_role, 'Provider'::public.user_role) THEN
      UPDATE public.profiles
        SET requested_role = _meta
        WHERE id = auth.uid()
          AND requested_role IS NULL;
    END IF;
  END IF;

  RETURN _current;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_role() TO authenticated, service_role;

-- Strip privileges that were granted only by the signup auto-path
DELETE FROM public.verified_dealers
WHERE verified_by IS NULL
  AND note IN (
    'Opened from signup',
    'Claimed from signup',
    'Promoted from signup'
  );

DELETE FROM public.verified_providers
WHERE verified_by IS NULL
  AND notes IN (
    'Opened from signup',
    'Claimed from signup',
    'Promoted from signup'
  );

-- Demote roles that no longer have an admin-backed verification row.
-- Admin-approved accounts keep verified_by and keep their operating role.
ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_priv_escalation;

UPDATE public.profiles p
SET
  requested_role = coalesce(
    p.requested_role,
    CASE p.role::text
      WHEN 'Supplier' THEN 'Supplier'::public.user_role
      WHEN 'Provider' THEN 'Provider'::public.user_role
      ELSE NULL
    END
  ),
  role = 'Client'
WHERE p.role::text IN ('Supplier', 'Provider')
  AND NOT EXISTS (
    SELECT 1 FROM public.verified_dealers vd
    WHERE vd.user_id = p.id AND vd.verified_by IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.verified_providers vp
    WHERE vp.user_id = p.id AND vp.verified_by IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.role::text = 'admin'
  );

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_priv_escalation;

-- ---------------------------------------------------------------------------
-- 2. Superadmin: seed once, then make ensure_superadmin a no-op check
-- ---------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'
FROM auth.users u
WHERE lower(trim(u.email)) = 'ismailtolgasler@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Bootstrap removed. Admin membership is seeded / granted only by
  -- service_role or an existing admin RPC — never by email match from the client.
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_superadmin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_superadmin() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. claim_open_job: verified providers only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_open_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role::text = 'Provider'
  ) THEN
    RAISE EXCEPTION 'Not a provider';
  END IF;

  IF NOT public.is_verified_provider(auth.uid()) THEN
    RAISE EXCEPTION 'Provider not verified';
  END IF;

  UPDATE public.jobs
    SET provider_id = auth.uid(),
        status = 'InProgress'::public.job_status,
        dispatched_at = coalesce(dispatched_at, now())
    WHERE id = _job_id
      AND provider_id IS NULL
      AND status IN ('Pending'::public.job_status, 'Offered'::public.job_status);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job is no longer available';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_open_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_open_job(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. job_parts: no direct client UPDATE; payment_status stays RPC-only
--    approve_part / reject_part are SECURITY DEFINER (owner ≠ authenticated).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "parts: participants update" ON public.job_parts;
REVOKE UPDATE ON public.job_parts FROM authenticated;

CREATE OR REPLACE FUNCTION public.guard_job_parts_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Same pattern as prevent_job_direct_tamper: SECURITY DEFINER RPCs run as
  -- the function owner, so current_user is not 'authenticated'.
  IF current_user IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    RAISE EXCEPTION 'payment_status is RPC-only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_parts_guard_payment_status ON public.job_parts;
CREATE TRIGGER job_parts_guard_payment_status
  BEFORE UPDATE ON public.job_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_parts_payment_status();

REVOKE ALL ON FUNCTION public.guard_job_parts_payment_status() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Simulated payment intent: keep demo path, harden idempotency note
--     (PSP webhook will replace secured insert later — skill: payments stay simulated)
-- ---------------------------------------------------------------------------
-- Keep the oldest secured intent per job, drop duplicates, then unique-index.
DELETE FROM public.payment_intents a
USING public.payment_intents b
WHERE a.status = 'secured'
  AND b.status = 'secured'
  AND a.job_id = b.job_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_one_secured_per_job
  ON public.payment_intents (job_id)
  WHERE status = 'secured';

-- ---------------------------------------------------------------------------
-- 6. Boatshow leads: length + rate limits on anon insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boatshow_leads_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_hits int;
  window_hits int;
BEGIN
  NEW.full_name := trim(NEW.full_name);
  NEW.phone := trim(NEW.phone);
  IF NEW.full_name IS NULL OR length(NEW.full_name) < 2 OR length(NEW.full_name) > 120 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;
  IF NEW.phone IS NULL OR length(NEW.phone) < 6 OR length(NEW.phone) > 40 THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;
  IF NEW.company IS NOT NULL AND length(NEW.company) > 160 THEN
    RAISE EXCEPTION 'invalid company';
  END IF;
  IF NEW.email IS NOT NULL AND length(NEW.email) > 160 THEN
    RAISE EXCEPTION 'invalid email';
  END IF;
  IF NEW.note IS NOT NULL AND length(NEW.note) > 2000 THEN
    RAISE EXCEPTION 'invalid note';
  END IF;
  IF NEW.source IS NOT NULL AND length(NEW.source) > 64 THEN
    NEW.source := left(NEW.source, 64);
  END IF;

  SELECT count(*)::int INTO phone_hits
  FROM public.boatshow_leads
  WHERE phone = NEW.phone
    AND created_at > now() - interval '1 hour';
  IF phone_hits >= 3 THEN
    RAISE EXCEPTION 'lead rate limited';
  END IF;

  SELECT count(*)::int INTO window_hits
  FROM public.boatshow_leads
  WHERE created_at > now() - interval '10 minutes';
  IF window_hits >= 40 THEN
    RAISE EXCEPTION 'lead rate limited';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boatshow_leads_guard_bi ON public.boatshow_leads;
CREATE TRIGGER boatshow_leads_guard_bi
  BEFORE INSERT ON public.boatshow_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.boatshow_leads_guard();
