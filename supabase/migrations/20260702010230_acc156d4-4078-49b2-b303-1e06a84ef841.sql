
-- 1. Add Supplier to role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Supplier';

-- 2. Extend profiles with supplier business fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS home_marina text,
  ADD COLUMN IF NOT EXISTS home_lat numeric,
  ADD COLUMN IF NOT EXISTS home_lng numeric;

-- 3. Extend parts_catalog with marina coordinates (fallback for delivery-time calc)
ALTER TABLE public.parts_catalog
  ADD COLUMN IF NOT EXISTS marina_lat numeric,
  ADD COLUMN IF NOT EXISTS marina_lng numeric;

-- 4. RLS: allow suppliers to manage their own inventory
DROP POLICY IF EXISTS "suppliers_manage_own_parts" ON public.parts_catalog;
CREATE POLICY "suppliers_manage_own_parts"
  ON public.parts_catalog
  FOR ALL
  TO authenticated
  USING (supplier_id = auth.uid())
  WITH CHECK (supplier_id = auth.uid());
