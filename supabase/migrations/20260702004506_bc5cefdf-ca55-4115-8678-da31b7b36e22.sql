
-- =========== Routine service packages ===========
CREATE TABLE public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title_tr text NOT NULL,
  title_en text NOT NULL,
  category text NOT NULL CHECK (category IN ('mechanic','diver')),
  base_duration_min int DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_packages TO anon, authenticated;
GRANT ALL ON public.service_packages TO service_role;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages_read_all" ON public.service_packages FOR SELECT USING (true);

CREATE TABLE public.provider_service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.service_packages(id) ON DELETE CASCADE,
  price numeric(10,2) NOT NULL,
  eta_minutes int DEFAULT 120,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, package_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_service_packages TO authenticated;
GRANT ALL ON public.provider_service_packages TO service_role;
ALTER TABLE public.provider_service_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psp_read_all_auth" ON public.provider_service_packages FOR SELECT TO authenticated USING (true);
CREATE POLICY "psp_owner_write" ON public.provider_service_packages FOR ALL TO authenticated
  USING (provider_id = auth.uid()) WITH CHECK (provider_id = auth.uid());

-- =========== Spare parts marketplace ===========
CREATE TABLE public.parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  brand text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL,
  stock int NOT NULL DEFAULT 0,
  compatibility text[] DEFAULT '{}',
  marina text,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.parts_catalog TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.parts_catalog TO authenticated;
GRANT ALL ON public.parts_catalog TO service_role;
ALTER TABLE public.parts_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parts_read_all" ON public.parts_catalog FOR SELECT USING (true);
CREATE POLICY "parts_supplier_write" ON public.parts_catalog FOR ALL TO authenticated
  USING (supplier_id = auth.uid()) WITH CHECK (supplier_id = auth.uid());

CREATE INDEX parts_brand_cat_idx ON public.parts_catalog(brand, category);

CREATE TABLE public.part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total numeric(10,2) NOT NULL,
  commission numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'Paid',
  delivery_marina text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.part_orders TO authenticated;
GRANT ALL ON public.part_orders TO service_role;
ALTER TABLE public.part_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_buyer_read" ON public.part_orders FOR SELECT TO authenticated USING (buyer_id = auth.uid());
CREATE POLICY "orders_buyer_insert" ON public.part_orders FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());

CREATE TABLE public.part_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.part_orders(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES public.parts_catalog(id),
  qty int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  name_snapshot text NOT NULL
);
GRANT SELECT, INSERT ON public.part_order_items TO authenticated;
GRANT ALL ON public.part_order_items TO service_role;
ALTER TABLE public.part_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_buyer_read" ON public.part_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.part_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
CREATE POLICY "order_items_buyer_insert" ON public.part_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.part_orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

-- =========== RPC: checkout cart ===========
CREATE OR REPLACE FUNCTION public.checkout_parts_cart(_items jsonb, _delivery_marina text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'part missing'; END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    _total := _total + _p.price * _qty;
  END LOOP;
  _commission := round(_total * 0.10, 2);
  INSERT INTO public.part_orders(buyer_id, total, commission, delivery_marina)
    VALUES (auth.uid(), _total, _commission, _delivery_marina)
    RETURNING id INTO _order_id;
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    UPDATE public.parts_catalog SET stock = GREATEST(0, stock - _qty) WHERE id = _p.id;
  END LOOP;
  -- ledger commission
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);
  RETURN _order_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text) TO authenticated;

-- Allow platform_ledger nullable job_id for parts commissions
ALTER TABLE public.platform_ledger ALTER COLUMN job_id DROP NOT NULL;

-- =========== Seed catalog ===========
INSERT INTO public.service_packages (key, title_tr, title_en, category, base_duration_min) VALUES
  ('svc_100h', '100 Saat Motor Servisi', '100-Hour Engine Service', 'mechanic', 180),
  ('svc_anode', 'Anot / Tutya Değişimi', 'Anode / Tutya Replacement', 'diver', 60),
  ('svc_hull', 'Karina Temizliği', 'Hull Cleaning', 'diver', 120),
  ('svc_impeller', 'Impeller Değişimi', 'Impeller Replacement', 'mechanic', 90),
  ('svc_winter', 'Kış Bakımı (Winterization)', 'Winterization Service', 'mechanic', 240)
ON CONFLICT (key) DO NOTHING;
