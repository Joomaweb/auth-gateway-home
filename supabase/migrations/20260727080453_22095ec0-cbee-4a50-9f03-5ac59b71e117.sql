
CREATE OR REPLACE FUNCTION public.payment_update_order(
  _order_id uuid,
  _status text,
  _square_status text,
  _square_payment_id text,
  _paid_at timestamptz DEFAULT NULL
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
    paid_at = COALESCE(_paid_at, paid_at),
    updated_at = now()
  WHERE id = _order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.payment_update_order(uuid, text, text, text, timestamptz) TO anon, authenticated;
