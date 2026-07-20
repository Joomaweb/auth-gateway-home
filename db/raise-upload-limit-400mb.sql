-- Run in the SQL Editor.
-- Raises the 'upload' bucket file size limit to 400MB (doubled from 200MB).
UPDATE storage.buckets
SET file_size_limit = 419430400  -- 400 MB
WHERE id = 'upload';
