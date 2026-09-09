
-- 1. Remove temporary permissive policies
DROP POLICY IF EXISTS "Temporary simulation jobs create access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation jobs edit access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation jobs read access" ON public.jobs;
DROP POLICY IF EXISTS "Temporary simulation profiles create access" ON public.profiles;
DROP POLICY IF EXISTS "Temporary simulation profiles edit access" ON public.profiles;
DROP POLICY IF EXISTS "Temporary simulation profiles read access" ON public.profiles;

-- 2. Prevent privilege escalation via profile self-update.
-- Trigger blocks changes to role and wallet_balance unless done by service_role or an admin.
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
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
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change role';
  END IF;
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    RAISE EXCEPTION 'Not allowed to change wallet_balance';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_priv_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_priv_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 3. Restrict catalog reads to authenticated users
DROP POLICY IF EXISTS "parts_read_all" ON public.parts_catalog;
CREATE POLICY "parts_read_authenticated" ON public.parts_catalog
FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "packages_read_all" ON public.service_packages;
CREATE POLICY "packages_read_authenticated" ON public.service_packages
FOR SELECT TO authenticated USING (true);

-- 4. Lock down SECURITY DEFINER helpers from being called directly by clients.
-- has_role and set_updated_at are internal; other RPCs remain callable by authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
