
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS promo_banner jsonb DEFAULT '{"enabled":false,"title":"","description":"","coupon_code":"","button_text":"Get Discount","image_url":""}'::jsonb;

CREATE TABLE IF NOT EXISTS public.banner_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  coupon_code text,
  source text DEFAULT 'popup',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS banner_subscribers_email_unique ON public.banner_subscribers (lower(email));

GRANT SELECT, INSERT ON public.banner_subscribers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banner_subscribers TO authenticated;
GRANT ALL ON public.banner_subscribers TO service_role;

ALTER TABLE public.banner_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON public.banner_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view subscribers" ON public.banner_subscribers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subscribers" ON public.banner_subscribers
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.banner_subscribers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.banner_subscribers;
