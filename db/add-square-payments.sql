-- Run this in your Supabase SQL editor (https://supabase.mako-chat.com)
-- Adds Square payment tracking columns used by the webhook + checkout flow.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS square_payment_id text,
  ADD COLUMN IF NOT EXISTS square_status text;

CREATE INDEX IF NOT EXISTS orders_square_payment_id_idx
  ON public.orders (square_payment_id);
