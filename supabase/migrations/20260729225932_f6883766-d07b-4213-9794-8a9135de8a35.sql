-- Demo seed rows: no dealer owns them. Guard against deleting anything ordered.
DELETE FROM public.parts_catalog p
WHERE p.supplier_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.part_order_items i WHERE i.part_id = p.id);

-- Fabricated normalized provider coordinates (Math.random at signup).
ALTER TABLE public.provider_details ALTER COLUMN lat DROP NOT NULL;
ALTER TABLE public.provider_details ALTER COLUMN lng DROP NOT NULL;

UPDATE public.provider_details
SET lat = NULL, lng = NULL
WHERE (lat IS NOT NULL AND abs(lat) < 1) AND (lng IS NOT NULL AND abs(lng) < 1);