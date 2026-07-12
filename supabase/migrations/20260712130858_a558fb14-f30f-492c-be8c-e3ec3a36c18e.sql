
CREATE POLICY "upload public read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'upload');
CREATE POLICY "upload authed insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'upload');
CREATE POLICY "upload owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'upload' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'upload' AND owner = auth.uid());
CREATE POLICY "upload owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'upload' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));
