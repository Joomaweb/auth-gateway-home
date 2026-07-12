REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.order_items FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.categories FROM anon;
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.product_variants FROM anon;
REVOKE ALL ON public.store_settings FROM anon;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT ON public.store_settings TO anon;