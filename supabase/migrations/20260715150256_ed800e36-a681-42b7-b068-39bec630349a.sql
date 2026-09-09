-- Fix: Public bucket allows listing — drop broad SELECT policy on storage.objects for part-images.
-- Public bucket files remain accessible via public CDN URLs (getPublicUrl) without needing a SELECT RLS policy.
-- Removing the policy prevents anonymous clients from listing/enumerating all files in the bucket.
DROP POLICY IF EXISTS part_images_public_read ON storage.objects;

-- Fix: provider_details missing explicit DELETE policy — add owner/admin scoped DELETE policy.
CREATE POLICY "provider_details: owner or admin delete"
  ON public.provider_details
  FOR DELETE
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
