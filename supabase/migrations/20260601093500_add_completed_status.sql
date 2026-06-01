-- Add 'completed' to request_status enum type to support manual withdrawal completion
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'completed';
