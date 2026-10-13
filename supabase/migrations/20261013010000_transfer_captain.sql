-- Transfer Captain desk: boat owners (Client / captain accounts) post an urgent
-- need for a skipper; other captain accounts apply with license docs + CV.

CREATE TABLE IF NOT EXISTS public.transfer_captain_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vessel_name text NOT NULL CHECK (char_length(btrim(vessel_name)) BETWEEN 2 AND 120),
  marina text CHECK (marina IS NULL OR char_length(marina) <= 120),
  urgency text NOT NULL DEFAULT 'urgent'
    CHECK (urgency IN ('urgent', 'soon', 'planned')),
  needed_from timestamptz,
  needed_until timestamptz,
  location_note text CHECK (location_note IS NULL OR char_length(location_note) <= 400),
  brief text NOT NULL CHECK (char_length(btrim(brief)) BETWEEN 8 AND 2000),
  lat double precision CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90)),
  lng double precision CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180)),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'matched', 'cancelled', 'completed')),
  accepted_application_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transfer_captain_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.transfer_captain_requests(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 20),
  license_no text CHECK (license_no IS NULL OR char_length(license_no) <= 80),
  experience_years int CHECK (experience_years IS NULL OR (experience_years >= 0 AND experience_years <= 60)),
  cv_text text CHECK (cv_text IS NULL OR char_length(cv_text) <= 4000),
  cv_path text CHECK (
    cv_path IS NULL
    OR (
      char_length(cv_path) BETWEEN 8 AND 300
      AND cv_path LIKE (applicant_id::text || '/%')
      AND cv_path !~ '\.\.'
    )
  ),
  license_path text NOT NULL CHECK (
    char_length(license_path) BETWEEN 8 AND 300
    AND license_path LIKE (applicant_id::text || '/%')
    AND license_path !~ '\.\.'
  ),
  id_doc_path text CHECK (
    id_doc_path IS NULL
    OR (
      char_length(id_doc_path) BETWEEN 8 AND 300
      AND id_doc_path LIKE (applicant_id::text || '/%')
      AND id_doc_path !~ '\.\.'
    )
  ),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, applicant_id)
);

ALTER TABLE public.transfer_captain_requests
  DROP CONSTRAINT IF EXISTS transfer_captain_requests_accepted_application_id_fkey;
ALTER TABLE public.transfer_captain_requests
  ADD CONSTRAINT transfer_captain_requests_accepted_application_id_fkey
  FOREIGN KEY (accepted_application_id)
  REFERENCES public.transfer_captain_applications(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS transfer_captain_requests_open_idx
  ON public.transfer_captain_requests (status, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS transfer_captain_requests_requester_idx
  ON public.transfer_captain_requests (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transfer_captain_applications_request_idx
  ON public.transfer_captain_applications (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS transfer_captain_applications_applicant_idx
  ON public.transfer_captain_applications (applicant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.is_captain_client(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- profiles.role may be text or user_role depending on DB vintage; compare as text.
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role::text = 'Client'
  );
$$;

REVOKE ALL ON FUNCTION public.is_captain_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_captain_client(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_transfer_captain_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transfer_captain_requests_touch ON public.transfer_captain_requests;
CREATE TRIGGER transfer_captain_requests_touch
  BEFORE UPDATE ON public.transfer_captain_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_transfer_captain_request();

ALTER TABLE public.transfer_captain_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_captain_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tcr: captain insert own" ON public.transfer_captain_requests;
CREATE POLICY "tcr: captain insert own"
  ON public.transfer_captain_requests FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND public.is_captain_client(auth.uid())
  );

DROP POLICY IF EXISTS "tcr: captain read open or own" ON public.transfer_captain_requests;
CREATE POLICY "tcr: captain read open or own"
  ON public.transfer_captain_requests FOR SELECT TO authenticated
  USING (
    public.is_captain_client(auth.uid())
    AND (status = 'open' OR requester_id = auth.uid())
  );

DROP POLICY IF EXISTS "tcr: owner update" ON public.transfer_captain_requests;
CREATE POLICY "tcr: owner update"
  ON public.transfer_captain_requests FOR UPDATE TO authenticated
  USING (requester_id = auth.uid())
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "tcr: admin read" ON public.transfer_captain_requests;
CREATE POLICY "tcr: admin read"
  ON public.transfer_captain_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tca: captain apply" ON public.transfer_captain_applications;
CREATE POLICY "tca: captain apply"
  ON public.transfer_captain_applications FOR INSERT TO authenticated
  WITH CHECK (
    applicant_id = auth.uid()
    AND public.is_captain_client(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.transfer_captain_requests r
      WHERE r.id = request_id
        AND r.status = 'open'
        AND r.requester_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "tca: parties read" ON public.transfer_captain_applications;
CREATE POLICY "tca: parties read"
  ON public.transfer_captain_applications FOR SELECT TO authenticated
  USING (
    applicant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.transfer_captain_requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "tca: applicant update own pending" ON public.transfer_captain_applications;
CREATE POLICY "tca: applicant update own pending"
  ON public.transfer_captain_applications FOR UPDATE TO authenticated
  USING (applicant_id = auth.uid() AND status = 'pending')
  WITH CHECK (applicant_id = auth.uid());

DROP POLICY IF EXISTS "tca: owner update status" ON public.transfer_captain_applications;
CREATE POLICY "tca: owner update status"
  ON public.transfer_captain_applications FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.transfer_captain_requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transfer_captain_requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
  );

REVOKE ALL ON public.transfer_captain_requests FROM PUBLIC, anon;
REVOKE ALL ON public.transfer_captain_applications FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.transfer_captain_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transfer_captain_applications TO authenticated;
GRANT ALL ON public.transfer_captain_requests TO service_role;
GRANT ALL ON public.transfer_captain_applications TO service_role;

CREATE OR REPLACE FUNCTION public.accept_transfer_captain_application(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.transfer_captain_requests%ROWTYPE;
  _app public.transfer_captain_applications%ROWTYPE;
BEGIN
  IF NOT public.is_captain_client(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _app
  FROM public.transfer_captain_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'application_not_found';
  END IF;

  SELECT * INTO _req
  FROM public.transfer_captain_requests
  WHERE id = _app.request_id
  FOR UPDATE;

  IF NOT FOUND OR _req.requester_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _req.status <> 'open' OR _app.status <> 'pending' THEN
    RAISE EXCEPTION 'not_open';
  END IF;

  UPDATE public.transfer_captain_applications
     SET status = 'accepted'
   WHERE id = _app.id;

  UPDATE public.transfer_captain_applications
     SET status = 'rejected'
   WHERE request_id = _req.id
     AND id <> _app.id
     AND status = 'pending';

  UPDATE public.transfer_captain_requests
     SET status = 'matched',
         accepted_application_id = _app.id,
         updated_at = now()
   WHERE id = _req.id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_transfer_captain_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_transfer_captain_application(uuid) TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transfer-captain-docs',
  'transfer-captain-docs',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "tcd_owner_select" ON storage.objects;
CREATE POLICY "tcd_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transfer-captain-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "tcd_owner_insert" ON storage.objects;
CREATE POLICY "tcd_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'transfer-captain-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.is_captain_client(auth.uid())
  );

DROP POLICY IF EXISTS "tcd_owner_update" ON storage.objects;
CREATE POLICY "tcd_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'transfer-captain-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'transfer-captain-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "tcd_owner_delete" ON storage.objects;
CREATE POLICY "tcd_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'transfer-captain-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "tcd_request_owner_select" ON storage.objects;
CREATE POLICY "tcd_request_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'transfer-captain-docs'
    AND EXISTS (
      SELECT 1
      FROM public.transfer_captain_applications a
      JOIN public.transfer_captain_requests r ON r.id = a.request_id
      WHERE r.requester_id = auth.uid()
        AND (
          a.license_path = name
          OR a.cv_path = name
          OR a.id_doc_path = name
        )
    )
  );
