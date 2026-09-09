-- Prevent stock from ever going negative at the database level.
ALTER TABLE public.parts_catalog
  DROP CONSTRAINT IF EXISTS parts_catalog_stock_nonnegative;
ALTER TABLE public.parts_catalog
  ADD CONSTRAINT parts_catalog_stock_nonnegative CHECK (stock >= 0);

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
SET search_path = public
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

  -- Phase 1: lock rows, validate stock, compute totals. Nothing is written yet,
  -- so any RAISE below aborts the transaction with no order/items/stock changes.
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT * INTO _p FROM public.parts_catalog
      WHERE id = (_item->>'part_id')::uuid
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: part missing';
    END IF;
    _qty := COALESCE((_item->>'qty')::int, 1);
    IF _qty <= 0 THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: invalid qty for %', _p.name;
    END IF;
    IF _p.stock < _qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK: % (available %, requested %)',
        _p.name, _p.stock, _qty;
    END IF;
    _total := _total + _p.price * _qty;
    IF _dealer IS NULL THEN _dealer := _p.supplier_id; END IF;
  END LOOP;

  _commission := round(_total * 0.10, 2);

  -- Phase 2: create order + items and decrement stock.
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
    SELECT * INTO _p FROM public.parts_catalog
      WHERE id = (_item->>'part_id')::uuid
      FOR UPDATE;
    _qty := COALESCE((_item->>'qty')::int, 1);
    INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
      VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
    -- Rows are already locked and validated above; the CHECK constraint is a
    -- final safeguard against races or malformed callers.
    UPDATE public.parts_catalog
      SET stock = stock - _qty
      WHERE id = _p.id;
  END LOOP;

  -- TODO(phase-9): defer ledger insert until dealer marks Delivered / escrow release.
  INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
    VALUES (NULL, _commission, _total - _commission);

  RETURN _order_id;
END
$function$;
