ALTER TABLE public.site_visits ADD COLUMN IF NOT EXISTS visitor_id text;
CREATE INDEX IF NOT EXISTS site_visits_visitor_id_idx ON public.site_visits (visitor_id);
CREATE INDEX IF NOT EXISTS site_visits_created_at_idx ON public.site_visits (created_at DESC);