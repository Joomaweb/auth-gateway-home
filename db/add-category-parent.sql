-- Add nested categories (subcategories): woman -> tops -> item
-- Run this once in your Supabase SQL editor.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON public.categories(parent_id);
