-- Role-based emergency service & diver call network.
-- Captains insert pending calls; providers accept via SECURITY DEFINER RPC.

CREATE TABLE public.emergency_service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vessel_name text NOT NULL DEFAULT '',
  category text NOT NULL,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  bay_name text,
  description text NOT NULL DEFAULT '',
  urgency_level text NOT NULL DEFAULT 'urgent',
  assigned_provider_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emergency_service_requests_category_check
    CHECK (category IN ('diver', 'mechanic', 'electrician', 'towing')),
  CONSTRAINT emergency_service_requests_urgency_check
    CHECK (urgency_level IN ('urgent', 'standard')),
  CONSTRAINT emergency_service_requests_status_check
    CHECK (status IN ('pending', 'en_route', 'on_scene', 'completed')),
  CONSTRAINT emergency_service_requests_latlng_bounds
    CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180),
  CONSTRAINT emergency_service_requests_vessel_len
    CHECK (char_length(vessel_name) <= 80),
  CONSTRAINT emergency_service_requests_bay_len
    CHECK (char_length(coalesce(bay_name, '')) <= 120),
  CONSTRAINT emergency_service_requests_desc_len
    CHECK (char_length(description) <= 2000)
);

CREATE INDEX emergency_service_requests_status_idx
  ON public.emergency_service_requests (status, created_at DESC);
CREATE INDEX emergency_service_requests_user_idx
  ON public.emergency_service_requests (user_id, created_at DESC);
CREATE INDEX emergency_service_requests_provider_idx
  ON public.emergency_service_requests (assigned_provider_id, status);

ALTER TABLE public.emergency_service_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.emergency_service_requests TO authenticated;
GRANT ALL ON public.emergency_service_requests TO service_role;

CREATE POLICY "esr: insert own pending" ON public.emergency_service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND assigned_provider_id IS NULL
    AND status = 'pending'
  );

CREATE POLICY "esr: read own" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "esr: providers read pending" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'Provider'
    )
  );

CREATE POLICY "esr: assigned provider read" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (assigned_provider_id = auth.uid());

CREATE POLICY "esr: admins read all" ON public.emergency_service_requests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.accept_emergency_request(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Provider'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.emergency_service_requests
    SET assigned_provider_id = auth.uid(),
        status = 'en_route'
    WHERE id = _id
      AND status = 'pending'
      AND assigned_provider_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Call already taken or not found';
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.accept_emergency_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_emergency_request(uuid) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_service_requests;
