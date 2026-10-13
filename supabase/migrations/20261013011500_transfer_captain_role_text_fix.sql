-- Repair: live profiles.role is text, not user_role. Re-define the helper so
-- the rest of transfer-captain policies/RPCs can be applied safely.

CREATE OR REPLACE FUNCTION public.is_captain_client(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role::text = 'Client'
  );
$$;

REVOKE ALL ON FUNCTION public.is_captain_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_captain_client(uuid) TO authenticated, service_role;
