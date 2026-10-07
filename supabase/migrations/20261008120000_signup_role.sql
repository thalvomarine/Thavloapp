-- Signup was stored as Client and the chosen role sat in requested_role,
-- so a dealer opened the captain cockpit. Stamp the chosen role at insert,
-- and promote accounts that already asked for Supplier or Provider.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('thalvo.role_claim', true) = '1' THEN
    RETURN NEW;
  END IF;
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
    RAISE EXCEPTION 'Not allowed to change wallet_balance';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_profile_insert_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('thalvo.signup_role', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.role := 'Client'::public.user_role;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requested public.user_role;
  _role public.user_role;
BEGIN
  BEGIN
    _requested := nullif(new.raw_user_meta_data->>'role', '')::public.user_role;
  EXCEPTION WHEN others THEN
    _requested := NULL;
  END;

  _role := coalesce(_requested, 'Client'::public.user_role);
  PERFORM set_config('thalvo.signup_role', '1', true);

  INSERT INTO public.profiles (
    id, full_name, boat_name, role, requested_role,
    preferred_language, account_type, business_name, home_marina
  ) VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'boat_name',
    _role,
    CASE WHEN _role = 'Client'::public.user_role THEN NULL ELSE _role END,
    coalesce((new.raw_user_meta_data->>'preferred_language')::public.language_code, 'tr'),
    nullif(new.raw_user_meta_data->>'account_type', ''),
    nullif(new.raw_user_meta_data->>'business_name', ''),
    nullif(new.raw_user_meta_data->>'home_marina', '')
  );

  INSERT INTO public.profile_contacts (id, phone)
  VALUES (new.id, nullif(new.raw_user_meta_data->>'phone', ''))
  ON CONFLICT (id) DO UPDATE
    SET phone = excluded.phone, updated_at = now();

  IF _role = 'Supplier'::public.user_role THEN
    INSERT INTO public.verified_dealers (user_id, note)
    VALUES (new.id, 'Opened from signup')
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role = 'Provider'::public.user_role THEN
    INSERT INTO public.verified_providers (user_id, notes)
    VALUES (new.id, 'Opened from signup')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_signup_role()
RETURNS public.user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current public.user_role;
  _requested public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT role, requested_role INTO _current, _requested
  FROM public.profiles
  WHERE id = auth.uid();

  IF _current IS NULL THEN
    RETURN 'Client'::public.user_role;
  END IF;
  IF _current IS DISTINCT FROM 'Client'::public.user_role THEN
    RETURN _current;
  END IF;

  IF _requested IS NULL OR _requested = 'Client'::public.user_role THEN
    BEGIN
      _requested := nullif(
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
        ''
      )::public.user_role;
    EXCEPTION WHEN others THEN
      _requested := NULL;
    END;
  END IF;

  IF _requested IS NULL OR _requested = 'Client'::public.user_role THEN
    RETURN 'Client'::public.user_role;
  END IF;
  IF _requested NOT IN ('Supplier'::public.user_role, 'Provider'::public.user_role) THEN
    RETURN 'Client'::public.user_role;
  END IF;

  PERFORM set_config('thalvo.role_claim', '1', true);
  UPDATE public.profiles
    SET role = _requested
    WHERE id = auth.uid();

  IF _requested = 'Supplier'::public.user_role THEN
    INSERT INTO public.verified_dealers (user_id, note)
    VALUES (auth.uid(), 'Claimed from signup')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.verified_providers (user_id, notes)
    VALUES (auth.uid(), 'Claimed from signup')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN _requested;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_signup_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_role() TO authenticated, service_role;

ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_priv_escalation;

UPDATE public.profiles
SET role = requested_role
WHERE role = 'Client'::public.user_role
  AND requested_role IN ('Supplier'::public.user_role, 'Provider'::public.user_role);

INSERT INTO public.verified_dealers (user_id, note)
SELECT id, 'Promoted from signup'
FROM public.profiles
WHERE role = 'Supplier'::public.user_role
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.verified_providers (user_id, notes)
SELECT id, 'Promoted from signup'
FROM public.profiles
WHERE role = 'Provider'::public.user_role
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_priv_escalation;
