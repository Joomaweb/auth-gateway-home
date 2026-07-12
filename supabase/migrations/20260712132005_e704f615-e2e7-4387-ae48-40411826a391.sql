ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS about jsonb NOT NULL DEFAULT '{"title":"About ATELIER","body":"A boutique for classic, refined fashion — premium fabrics, timeless cuts, responsible craftsmanship.","features":[{"title":"Quality","body":"Premium fabrics and meticulous craftsmanship."},{"title":"Classic","body":"Cuts that never go out of style."},{"title":"Transparency","body":"Fair pricing, no hidden fees."}]}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '[{"name":"Cash on Delivery","enabled":true}]'::jsonb,
  ADD COLUMN IF NOT EXISTS paypal jsonb NOT NULL DEFAULT '{"enabled":false,"client_id":"","mode":"sandbox"}'::jsonb;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS orders_invoice_number_idx
  ON public.orders (invoice_number)
  WHERE invoice_number IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS compare_at_price numeric;

UPDATE public.order_items
SET variant = concat_ws(' / ', nullif(size, ''), nullif(color, ''))
WHERE variant IS NULL AND (nullif(size, '') IS NOT NULL OR nullif(color, '') IS NOT NULL);

UPDATE public.store_settings
SET
  payment_methods = COALESCE(payment_methods, '[{"name":"Cash on Delivery","enabled":true}]'::jsonb),
  paypal = COALESCE(paypal, '{"enabled":false,"client_id":"","mode":"sandbox"}'::jsonb),
  about = COALESCE(about, '{"title":"About ATELIER","body":"A boutique for classic, refined fashion — premium fabrics, timeless cuts, responsible craftsmanship.","features":[{"title":"Quality","body":"Premium fabrics and meticulous craftsmanship."},{"title":"Classic","body":"Cuts that never go out of style."},{"title":"Transparency","body":"Fair pricing, no hidden fees."}]}'::jsonb)
WHERE id = 1;