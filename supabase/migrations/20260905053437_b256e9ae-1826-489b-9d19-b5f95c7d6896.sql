CREATE OR REPLACE VIEW public.public_parts_catalog
WITH (security_barrier = true) AS
SELECT id, name, brand, category, sku, image_url, price, stock, compatibility, marina, created_at
FROM public.parts_catalog
WHERE active = true AND supplier_id IS NOT NULL;

GRANT SELECT ON public.public_parts_catalog TO anon;
GRANT SELECT ON public.public_parts_catalog TO authenticated;
GRANT ALL ON public.public_parts_catalog TO service_role;

DROP POLICY parts_read_anon ON public.parts_catalog;