-- Run this in your self-hosted Supabase SQL Editor.
-- Adds: product videos, "requires stock approval" flag, homepage hero video,
-- shipping zones (name/price/eta), and a video MIME allow-list on the upload bucket.

-- ===== products =====
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_url text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS requires_stock_approval boolean NOT NULL DEFAULT false;

-- ===== store_settings =====
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS hero_video text;

-- shipping_zones: [{ "name": "מרכז", "price": 25, "eta": "1-2 ימי עסקים" }, ...]
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS shipping_zones jsonb
  DEFAULT '[]'::jsonb;

-- ===== upload bucket: allow videos and raise size to 50MB =====
-- (Only updates if the bucket exists.)
UPDATE storage.buckets
SET
  file_size_limit = 52428800,  -- 50 MB
  allowed_mime_types = ARRAY[
    'image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon',
    'video/mp4','video/webm','video/quicktime'
  ]
WHERE id = 'upload';
