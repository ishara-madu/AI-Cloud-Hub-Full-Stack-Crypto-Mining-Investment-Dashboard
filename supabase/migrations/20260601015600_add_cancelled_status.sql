-- Add 'cancelled' to request_status enum type to support user cancellation of pending checkouts
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Enable Realtime replication for the deposit_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;
