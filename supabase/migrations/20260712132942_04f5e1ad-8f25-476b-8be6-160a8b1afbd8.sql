
-- Public read for catalog media
DROP POLICY IF EXISTS "Public read upload bucket" ON storage.objects;
CREATE POLICY "Public read upload bucket"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'upload');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Authenticated upload to upload bucket" ON storage.objects;
CREATE POLICY "Authenticated upload to upload bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'upload');

-- Authenticated users can update their files
DROP POLICY IF EXISTS "Authenticated update upload bucket" ON storage.objects;
CREATE POLICY "Authenticated update upload bucket"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'upload');

-- Authenticated users can delete their files
DROP POLICY IF EXISTS "Authenticated delete upload bucket" ON storage.objects;
CREATE POLICY "Authenticated delete upload bucket"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'upload');
