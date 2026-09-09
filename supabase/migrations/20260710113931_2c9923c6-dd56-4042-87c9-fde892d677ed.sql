
-- Public read for part-images bucket (bucket is public, but add explicit policy for clarity)
CREATE POLICY "part_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'part-images');

CREATE POLICY "part_images_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "part_images_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "part_images_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'part-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
