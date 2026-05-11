-- Run this in your self-hosted Supabase SQL Editor.
-- Adds branding (logo + favicon) and legal pages (terms + purchase policy)
-- to store_settings, plus ensures payments columns exist.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS branding jsonb
  DEFAULT '{"logo_url":"","favicon_url":"","site_name":"ATELIER"}'::jsonb;

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS legal jsonb
  DEFAULT '{"terms_en":"","terms_he":"","policy_en":"","policy_he":""}'::jsonb;
