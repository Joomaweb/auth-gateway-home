-- Run in Supabase SQL Editor.
-- Adds active_theme column to store_settings for the live theme switcher.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS active_theme TEXT DEFAULT 'classic';
