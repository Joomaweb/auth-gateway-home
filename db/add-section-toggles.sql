-- Run in your Supabase SQL Editor.
-- Toggles for showing/hiding the "Featured" and "On Sale" sections on the homepage.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS show_featured boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_sale boolean NOT NULL DEFAULT true;
