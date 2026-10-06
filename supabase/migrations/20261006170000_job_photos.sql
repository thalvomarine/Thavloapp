-- Private photos attached to an SOS / job card.
-- The captain uploads into their own folder. The assigned technician
-- can read a photo only when jobs.photo_url points at that object.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "job_photos_owner_insert" ON storage.objects;
CREATE POLICY "job_photos_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(name) ~ '\.(jpg|jpeg|png|webp)$'
  );

DROP POLICY IF EXISTS "job_photos_party_select" ON storage.objects;
CREATE POLICY "job_photos_party_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.photo_url = name
          AND (j.client_id = auth.uid() OR j.provider_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "job_photos_owner_delete" ON storage.objects;
CREATE POLICY "job_photos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'job-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
