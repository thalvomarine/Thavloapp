-- Server-side leak rejection, timed arrivals, dispute log,
-- aggregate trust signals, and one order per dealer.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_arrived(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs
    SET status = 'OnSite',
        arrived_at = COALESCE(arrived_at, now())
    WHERE id = _job_id AND provider_id = auth.uid();
END;
$$;

CREATE TABLE IF NOT EXISTS public.job_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES public.profiles(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_disputes: parties read" ON public.job_disputes;
CREATE POLICY "job_disputes: parties read"
  ON public.job_disputes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.client_id = auth.uid() OR j.provider_id = auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "job_disputes: parties insert" ON public.job_disputes;
CREATE POLICY "job_disputes: parties insert"
  ON public.job_disputes FOR INSERT TO authenticated
  WITH CHECK (
    opened_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id
        AND (j.client_id = auth.uid() OR j.provider_id = auth.uid())
    )
  );

GRANT SELECT, INSERT ON public.job_disputes TO authenticated;
GRANT ALL ON public.job_disputes TO service_role;

-- High-risk chat is rejected. A modified client cannot store the raw text.
CREATE OR REPLACE FUNCTION public.mask_job_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original text := COALESCE(NEW.text, '');
  forbidden text[] := ARRAY[
    'iban','bank','banka','hesap','transfer','havale','eft',
    'cash','nakit','elden',
    'whatsapp','wp','telegram','signal',
    'phone number','telefon','telefonum','ara beni','call me',
    'instagram','dm me','platform dışı','platform disi','komisyonsuz'
  ];
  w text;
BEGIN
  FOREACH w IN ARRAY forbidden LOOP
    IF original ~* ('\m' || regexp_replace(w, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M') THEN
      RAISE EXCEPTION 'LEAK_BLOCKED';
    END IF;
  END LOOP;

  IF original ~* '(\+?90 ?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}'
     OR original ~ '(\+?\d[\s\-().]?){7,}'
     OR original ~* '[A-Z]{2}\d{2}[A-Z0-9 ]{11,30}'
     OR original ~* '[[:alnum:]._+-]+@[[:alnum:]-]+\.[[:alnum:].-]+'
  THEN
    RAISE EXCEPTION 'LEAK_BLOCKED';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.mask_job_message() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reveal_contact_allowed()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.has_role(auth.uid(), 'admin');
END;
$$;

REVOKE ALL ON FUNCTION public.reveal_contact_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reveal_contact_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION public.provider_trust_signals(_provider uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _completed int;
  _disputes int;
  _samples int;
  _on_time int;
  _resp int;
  _median numeric;
  _verified boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT count(*) INTO _completed
  FROM public.jobs
  WHERE provider_id = _provider AND status = 'Completed';

  SELECT count(*) INTO _disputes
  FROM public.job_disputes d
  JOIN public.jobs j ON j.id = d.job_id
  WHERE j.provider_id = _provider;

  SELECT
    count(*) FILTER (
      WHERE arrived_at IS NOT NULL
        AND dispatched_at IS NOT NULL
        AND eta_minutes IS NOT NULL
    ),
    count(*) FILTER (
      WHERE arrived_at IS NOT NULL
        AND dispatched_at IS NOT NULL
        AND eta_minutes IS NOT NULL
        AND arrived_at <= dispatched_at + make_interval(mins => eta_minutes)
    )
  INTO _samples, _on_time
  FROM public.jobs
  WHERE provider_id = _provider;

  SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY mins)
  INTO _resp, _median
  FROM (
    SELECT EXTRACT(EPOCH FROM (o.created_at - j.created_at)) / 60.0 AS mins
    FROM public.job_offers o
    JOIN public.jobs j ON j.id = o.job_id
    WHERE o.provider_id = _provider
      AND o.created_at >= j.created_at
  ) s;

  SELECT
    EXISTS (SELECT 1 FROM public.verified_providers vp WHERE vp.user_id = _provider)
    OR EXISTS (
      SELECT 1 FROM public.provider_details pd
      WHERE pd.id = _provider
        AND pd.certification_url IS NOT NULL
        AND length(btrim(pd.certification_url)) > 0
    )
  INTO _verified;

  RETURN jsonb_build_object(
    'completed_jobs', COALESCE(_completed, 0),
    'dispute_count', COALESCE(_disputes, 0),
    'arrival_samples', COALESCE(_samples, 0),
    'arrival_on_time', COALESCE(_on_time, 0),
    'response_samples', COALESCE(_resp, 0),
    'median_response_minutes', _median,
    'verified', COALESCE(_verified, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.provider_trust_signals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_trust_signals(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text);
DROP FUNCTION IF EXISTS public.checkout_parts_cart(jsonb, text);

CREATE FUNCTION public.checkout_parts_cart(
  _items jsonb,
  _delivery_marina text,
  _vessel_id uuid DEFAULT NULL,
  _delivery_method text DEFAULT 'service_boat',
  _delivery_eta_minutes integer DEFAULT NULL,
  _delivery_location_label text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _order_id uuid;
  _ids uuid[] := '{}';
  _total numeric;
  _commission numeric;
  _item jsonb;
  _p public.parts_catalog%rowtype;
  _qty int;
  _dealer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'OUT_OF_STOCK: empty cart';
  END IF;

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
  END LOOP;

  FOR _dealer IN
    SELECT DISTINCT p.supplier_id
    FROM jsonb_array_elements(_items) AS item
    JOIN public.parts_catalog p ON p.id = (item->>'part_id')::uuid
  LOOP
    _total := 0;
    FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
      SELECT * INTO _p FROM public.parts_catalog
        WHERE id = (_item->>'part_id')::uuid;
      IF _p.supplier_id IS NOT DISTINCT FROM _dealer THEN
        _qty := COALESCE((_item->>'qty')::int, 1);
        _total := _total + _p.price * _qty;
      END IF;
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
    _ids := array_append(_ids, _order_id);

    FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
      SELECT * INTO _p FROM public.parts_catalog
        WHERE id = (_item->>'part_id')::uuid
        FOR UPDATE;
      IF _p.supplier_id IS NOT DISTINCT FROM _dealer THEN
        _qty := COALESCE((_item->>'qty')::int, 1);
        INSERT INTO public.part_order_items(order_id, part_id, qty, unit_price, name_snapshot)
          VALUES (_order_id, _p.id, _qty, _p.price, _p.name);
        UPDATE public.parts_catalog
          SET stock = stock - _qty
          WHERE id = _p.id;
      END IF;
    END LOOP;

    INSERT INTO public.platform_ledger(job_id, commission_amount, provider_payout)
      VALUES (NULL, _commission, _total - _commission);
  END LOOP;

  RETURN _ids;
END
$function$;

REVOKE ALL ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_parts_cart(jsonb, text, uuid, text, integer, text, text) TO authenticated;
