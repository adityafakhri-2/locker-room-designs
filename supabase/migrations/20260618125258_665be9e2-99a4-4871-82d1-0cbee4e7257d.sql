
-- product-images: public read, admin write
CREATE POLICY "product_images_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');
CREATE POLICY "product_images_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "product_images_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "product_images_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(),'admin'));

-- certificates: public read, admin write
CREATE POLICY "certificates_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'certificates');
CREATE POLICY "certificates_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(),'admin'));

-- review-photos: public read, owner write (path uses user id prefix)
CREATE POLICY "review_photos_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'review-photos');
CREATE POLICY "review_photos_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'review-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- payment-proofs: owner + admin read, owner write
CREATE POLICY "proofs_owner_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "proofs_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
