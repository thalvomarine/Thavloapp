-- Public browsing surface: catalogue + service packages only.
GRANT SELECT ON public.parts_catalog TO anon;
GRANT SELECT ON public.service_packages TO anon;

DROP POLICY IF EXISTS parts_read_anon ON public.parts_catalog;
CREATE POLICY parts_read_anon
  ON public.parts_catalog
  FOR SELECT
  TO anon
  USING (active = true);

DROP POLICY IF EXISTS packages_read_anon ON public.service_packages;
CREATE POLICY packages_read_anon
  ON public.service_packages
  FOR SELECT
  TO anon
  USING (true);