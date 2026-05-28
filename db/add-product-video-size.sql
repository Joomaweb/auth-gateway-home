-- Add video size preference to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS video_size text NOT NULL DEFAULT 'large';
-- Allowed values: 'small' | 'medium' | 'large' | 'full'
