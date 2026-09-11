-- Superadmin bootstrap + provider claim-job + admin profile/job RPCs.

CREATE OR REPLACE FUNCTION public.ensure_superadmin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  em text;
BEGIN
  em := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  IF em IS DISTINCT FROM 'ismailtolgasler@gmail.com' THEN
    RETURN public.has_role(auth.uid(), 'admin');
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_superadmin() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_open_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Provider'::public.user_role
  ) THEN
    RAISE EXCEPTION 'Not a provider';
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

CREATE OR REPLACE FUNCTION public.admin_set_user_available(_user_id uuid, _available boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.profiles
    SET is_available = _available
    WHERE id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_available(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_available(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reassign_job(_job_id uuid, _provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.jobs
    SET provider_id = _provider_id,
        status = 'Accepted'::public.job_status,
        dispatched_at = now()
    WHERE id = _job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_job(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reassign_job(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_close_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.jobs
    SET status = 'Cancelled'::public.job_status
    WHERE id = _job_id
      AND status IS DISTINCT FROM 'Completed'::public.job_status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_close_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_close_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.jobs WHERE id = _job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_directory_role(_user_id uuid, _kind text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  kind text;
  new_role public.user_role;
  svc public.service_type;
  marina_label text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  kind := lower(trim(coalesce(_kind, '')));
  IF kind IN ('captain', 'client') THEN
    new_role := 'Client'::public.user_role;
  ELSIF kind = 'supplier' THEN
    new_role := 'Supplier'::public.user_role;
  ELSIF kind IN ('provider', 'diver', 'technician', 'usta') THEN
    new_role := 'Provider'::public.user_role;
  ELSE
    RAISE EXCEPTION 'Unknown directory role';
  END IF;

  UPDATE public.profiles
    SET role = new_role, requested_role = NULL
    WHERE id = _user_id;

  IF new_role = 'Provider'::public.user_role THEN
    svc := CASE
      WHEN kind = 'diver' THEN 'Underwater Diver'::public.service_type
      ELSE 'Marine Mechanic'::public.service_type
    END;
    SELECT coalesce(home_marina, '') INTO marina_label FROM public.profiles WHERE id = _user_id;
    INSERT INTO public.provider_details (id, service_type, marina)
      VALUES (_user_id, svc, marina_label)
      ON CONFLICT (id) DO UPDATE SET service_type = EXCLUDED.service_type;
    INSERT INTO public.verified_providers (user_id, verified_by, notes)
      VALUES (_user_id, auth.uid(), 'Approved via admin_set_directory_role')
      ON CONFLICT (user_id) DO NOTHING;
  ELSIF new_role = 'Supplier'::public.user_role THEN
    INSERT INTO public.verified_dealers (user_id, verified_by, note)
      VALUES (_user_id, auth.uid(), 'Approved via admin_set_directory_role')
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_directory_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_directory_role(uuid, text) TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
