-- Run this once in your self-hosted Supabase SQL editor
-- Adds shipment tracking to orders.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipment_status text NOT NULL DEFAULT 'preparing',
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS shipment_updated_at timestamptz;

-- Allowed values: 'preparing' | 'awaiting_shipment' | 'in_transit' | 'delivered'

-- Enable realtime so customers receive live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
