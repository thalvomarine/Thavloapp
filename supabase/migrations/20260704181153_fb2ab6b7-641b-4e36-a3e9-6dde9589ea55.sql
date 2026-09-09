-- P0 fix: providers without a matching provider_details row (or with a
-- different service_type) currently cannot insert offers. Mirror the
-- previously-added role-based read pool policy with a role-based insert
-- policy so any Provider can bid on any Pending job. The strict
-- service_type-scoped policy remains as an alternative permissive path.

CREATE POLICY "offers: providers insert on open jobs (role)"
ON public.job_offers
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id = auth.uid()
  AND public.is_provider(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_offers.job_id
      AND j.status = 'Pending'::public.job_status
  )
);
