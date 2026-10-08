-- Captain can cancel an open call and keep the vessel fix live for the technician.

ALTER TABLE public.emergency_service_requests
  DROP CONSTRAINT IF EXISTS emergency_service_requests_status_check;
ALTER TABLE public.emergency_service_requests
  ADD CONSTRAINT emergency_service_requests_status_check
  CHECK (status IN ('pending', 'en_route', 'on_scene', 'completed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.cancel_own_call(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job public.jobs%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
  IF NOT FOUND OR _job.client_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _job.status IN ('Completed', 'Cancelled') THEN
    RAISE EXCEPTION 'Call already closed';
  END IF;
  UPDATE public.jobs
    SET status = 'Cancelled'::public.job_status
    WHERE id = _job_id;
  UPDATE public.emergency_service_requests
    SET status = 'cancelled'
    WHERE user_id = auth.uid()
      AND status IN ('pending', 'en_route', 'on_scene');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_call(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.refresh_own_call_position(
  _job_id uuid,
  _lat numeric,
  _lng numeric,
  _accuracy_m numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat NOT BETWEEN -90 AND 90 OR _lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Invalid position';
  END IF;
  UPDATE public.jobs
    SET lat = _lat,
        lng = _lng,
        location_accuracy_m = _accuracy_m,
        location_captured_at = now()
    WHERE id = _job_id
      AND client_id = auth.uid()
      AND status NOT IN ('Completed', 'Cancelled');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.emergency_service_requests
    SET lat = _lat,
        lng = _lng
    WHERE user_id = auth.uid()
      AND status IN ('pending', 'en_route', 'on_scene');
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_own_call_position(uuid, numeric, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_own_call_position(uuid, numeric, numeric, numeric) TO authenticated;
