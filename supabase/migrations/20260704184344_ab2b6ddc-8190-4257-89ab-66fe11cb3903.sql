
-- 1. Restrict is_provider() SECURITY DEFINER function to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_provider(uuid) FROM PUBLIC, anon;

-- 2. Scope provider_details read access
DROP POLICY IF EXISTS "providers: readable by all authed" ON public.provider_details;
CREATE POLICY "provider_details: scoped read"
ON public.provider_details
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR live_status = 'Available'
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.provider_id = provider_details.id AND j.client_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE o.provider_id = provider_details.id AND j.client_id = auth.uid()
  )
);

-- 3. Scope provider_service_packages read access
DROP POLICY IF EXISTS "psp_read_all_auth" ON public.provider_service_packages;
CREATE POLICY "psp: scoped read"
ON public.provider_service_packages
FOR SELECT
TO authenticated
USING (
  provider_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.provider_details pd
    WHERE pd.id = provider_service_packages.provider_id
      AND pd.live_status = 'Available'
  )
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.provider_id = provider_service_packages.provider_id
      AND j.client_id = auth.uid()
  )
);
