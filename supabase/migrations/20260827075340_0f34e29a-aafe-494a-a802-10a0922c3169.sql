-- 1. Remove self-declared-role based open pool visibility
DROP POLICY IF EXISTS "jobs: providers read open pool (role)" ON public.jobs;

-- 2. Require admin-granted verification for open pool visibility
DROP POLICY IF EXISTS "jobs: providers read open pool" ON public.jobs;
CREATE POLICY "jobs: providers read open pool"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::public.job_status
  AND public.is_verified_provider(auth.uid())
  AND public.provider_offers_service(auth.uid(), service_type)
);

-- 3. Trigger-only function must not be callable from the API
REVOKE ALL ON FUNCTION public.prevent_profile_insert_privilege_escalation() FROM PUBLIC, anon, authenticated;