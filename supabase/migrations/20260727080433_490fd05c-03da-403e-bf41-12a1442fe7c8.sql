
CREATE OR REPLACE FUNCTION public.payment_get_order(_order_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', id,
    'total', total,
    'status', status,
    'square_payment_id', square_payment_id
  )
  FROM public.orders
  WHERE id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.payment_update_order(
  _order_id uuid,
  _status text,
  _square_status text,
  _square_payment_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET
    status = COALESCE(_status, status),
    square_status = COALESCE(_square_status, square_status),
    square_payment_id = COALESCE(_square_payment_id, square_payment_id),
    updated_at = now()
  WHERE id = _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_get_square_settings()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(square, '{}'::jsonb)
  FROM public.store_settings
  WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.payment_get_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_update_order(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.payment_get_square_settings() TO anon, authenticated;
