
CREATE OR REPLACE FUNCTION public.is_provider(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'Provider'
  )
$$;

-- Add a permissive SELECT policy so any Provider (with or without a
-- provider_details row / service_type match) can see the open pool.
-- Client UI badges category so mismatched providers can self-filter.
DROP POLICY IF EXISTS "jobs: providers read open pool (role)" ON public.jobs;
CREATE POLICY "jobs: providers read open pool (role)"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  status = 'Pending'::job_status
  AND public.is_provider(auth.uid())
);
