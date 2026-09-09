
-- 1. Profiles SELECT hardening
DROP POLICY IF EXISTS "Profiles: read all authed" ON public.profiles;

CREATE POLICY "Profiles: read own"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Profiles: admins read all"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Job participants can read each other's basic profile row (needed for names shown in job/offer UIs)
CREATE POLICY "Profiles: job participants read"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE (j.client_id = auth.uid() AND j.provider_id = profiles.id)
       OR (j.provider_id = auth.uid() AND j.client_id = profiles.id)
  )
  OR EXISTS (
    SELECT 1 FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE o.provider_id = profiles.id AND j.client_id = auth.uid()
  )
);

-- 2. Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Workflow RPCs: only authenticated users may invoke; never anon
REVOKE EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_sail(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_arrived(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_part(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_part(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_job(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.accept_offer(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_sail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_arrived(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_extra_part(uuid, text, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_part(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_part(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job(uuid) TO authenticated;
