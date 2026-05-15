-- Run in Supabase SQL Editor.
-- Raises the 'upload' bucket file size limit to 200MB for both images and videos.

UPDATE storage.buckets
SET file_size_limit = 209715200  -- 200 MB
WHERE id = 'upload';
