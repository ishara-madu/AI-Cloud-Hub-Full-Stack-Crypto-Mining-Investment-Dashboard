
-- Change payment_method from enum to text for custom payment methods
ALTER TABLE public.deposit_requests ALTER COLUMN payment_method TYPE text USING payment_method::text;
