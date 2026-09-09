DROP POLICY IF EXISTS "part_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "part_images_owner_update" ON storage.objects;

CREATE POLICY "part_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.is_verified_dealer(auth.uid())
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|avif|gif)$'
  );

CREATE POLICY "part_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'part-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND public.is_verified_dealer(auth.uid())
    AND lower(name) ~ '\.(jpg|jpeg|png|webp|avif|gif)$'
  );