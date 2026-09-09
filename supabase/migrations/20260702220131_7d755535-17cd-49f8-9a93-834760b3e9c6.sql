
-- Extend part_orders with logistics fields
ALTER TABLE public.part_orders
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vessel_id uuid REFERENCES public.vessels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_method text NOT NULL DEFAULT 'service_boat',
  ADD COLUMN IF NOT EXISTS delivery_eta_minutes integer,
  ADD COLUMN IF NOT EXISTS delivery_location_label text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS dealer_note text,
  ADD COLUMN IF NOT EXISTS subtotal numeric(10,2),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill subtotal from total on existing rows
UPDATE public.part_orders SET subtotal = total WHERE subtotal IS NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_part_orders_updated_at ON public.part_orders;
CREATE TRIGGER trg_part_orders_updated_at
  BEFORE UPDATE ON public.part_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Broaden status vocabulary (soft: text column, no enum change)
-- Allowed: Draft, Submitted, DealerReview, Confirmed, Preparing, OutForDelivery, Delivered, Completed, Cancelled, Paid (legacy)

-- Dealer visibility policy on part_orders
DROP POLICY IF EXISTS "orders_dealer_read" ON public.part_orders;
CREATE POLICY "orders_dealer_read" ON public.part_orders
  FOR SELECT TO authenticated
  USING (dealer_id = auth.uid());

DROP POLICY IF EXISTS "orders_dealer_update" ON public.part_orders;
CREATE POLICY "orders_dealer_update" ON public.part_orders
  FOR UPDATE TO authenticated
  USING (dealer_id = auth.uid())
  WITH CHECK (dealer_id = auth.uid());

-- Admin visibility
DROP POLICY IF EXISTS "orders_admin_read" ON public.part_orders;
CREATE POLICY "orders_admin_read" ON public.part_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Dealer visibility for order items
DROP POLICY IF EXISTS "order_items_dealer_read" ON public.part_order_items;
CREATE POLICY "order_items_dealer_read" ON public.part_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.part_orders o
    WHERE o.id = part_order_items.order_id AND o.dealer_id = auth.uid()
  ));

DROP POLICY IF EXISTS "order_items_admin_read" ON public.part_order_items;
CREATE POLICY "order_items_admin_read" ON public.part_order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Rewrite checkout function to capture logistics + dealer
CREATE OR REPLACE FUNCTION public.checkout_parts_cart(
  _items jsonb,
  _delivery_marina text,
  _vessel_id uuid DEFAULT NULL,
  _delivery_method text DEFAULT 'service_boat',
  _delivery_eta_minutes integer DEFAULT NULL,
  _delivery_location_label text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _order_id uuid;
  _total numeric := 0;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
  _dealer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  -- Compute total and resolve dealer from first item (single-dealer orders v1)
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'part missing'; END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    _total := _total + _p.price * _qty;
    IF _dealer IS NULL THEN _dealer := _p.supplier_id; END IF;
  END LOOP;

  _commission := round(_total * 0.10, 2);

  INSERT INTO public.part_orders(
    buyer_id, dealer_id, vessel_id, total, subtotal, commission,
    delivery_marina, delivery_method, delivery_eta_minutes,
    delivery_location_label, notes, status
  ) VALUES (
    auth.uid(), _dealer, _vessel_id, _total, _total, _commission,
    _delivery_marina, COALESCE(_delivery_method, 'service_boat'),
    _delivery_eta_minutes, _delivery_location_label, _notes, 'Submitted'
  ) RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog WHERE id = (_item->>'part_id')::uuid;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    UPDATE public.parts_catalog SET stock = GREATEST(0, stock - _qty) WHERE id = _p.id;
  END LOOP;

  -- TODO(phase-9): defer ledger insert until dealer marks Delivered / escrow release.
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);

  -- TODO(phase-9): Stripe payment intent + escrow hold, courier assignment,
  -- invoice generation, audit log entry.

  RETURN _order_id;
END $function$;
