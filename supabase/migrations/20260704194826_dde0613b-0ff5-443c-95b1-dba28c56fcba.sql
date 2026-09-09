
-- Helpers to break RLS recursion between profiles → jobs → provider_details → jobs.
-- All SECURITY DEFINER so cross-table lookups bypass RLS and cannot re-enter policy checks.

CREATE OR REPLACE FUNCTION public.user_is_job_participant_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE (j.client_id = auth.uid() AND j.provider_id = _other)
       OR (j.provider_id = auth.uid() AND j.client_id = _other)
  ) OR EXISTS (
    SELECT 1
    FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE (o.provider_id = _other AND j.client_id = auth.uid())
       OR (o.provider_id = auth.uid() AND j.client_id = _other)
  );
$$;

CREATE OR REPLACE FUNCTION public.provider_is_available(_provider uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = _provider AND pd.live_status = 'Available'
  );
$$;

CREATE OR REPLACE FUNCTION public.provider_offers_service(_provider uuid, _service public.service_type)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = _provider AND pd.service_type = _service
  );
$$;

REVOKE EXECUTE ON FUNCTION public.user_is_job_participant_with(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_is_available(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.provider_offers_service(uuid, public.service_type) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.user_is_job_participant_with(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_is_available(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provider_offers_service(uuid, public.service_type) TO authenticated, service_role;

-- A. profiles: replace recursive cross-table EXISTS with helper.
DROP POLICY IF EXISTS "Profiles: job participants read" ON public.profiles;
CREATE POLICY "Profiles: job participants read"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.user_is_job_participant_with(profiles.id));

-- B. provider_details: no direct jobs/job_offers references.
DROP POLICY IF EXISTS "provider_details: scoped read" ON public.provider_details;
CREATE POLICY "provider_details: scoped read"
ON public.provider_details
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR live_status = 'Available'
  OR public.user_is_job_participant_with(provider_details.id)
);

-- C. jobs open pool: replace direct provider_details EXISTS with helper.
DROP POLICY IF EXISTS "jobs: providers read open pool" ON public.jobs;
CREATE POLICY "jobs: providers read open pool"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::job_status
  AND public.provider_offers_service(auth.uid(), jobs.service_type)
);
