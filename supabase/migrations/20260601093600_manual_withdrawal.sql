-- Create withdrawal_methods table if not exists
CREATE TABLE IF NOT EXISTS public.withdrawal_methods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for withdrawal_methods
ALTER TABLE public.withdrawal_methods ENABLE ROW LEVEL SECURITY;

-- Drop existing select policy if exists and create
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.withdrawal_methods;
CREATE POLICY "Allow read for authenticated users" ON public.withdrawal_methods
    FOR SELECT TO authenticated USING (true);

-- Drop existing admin policy if exists and create
DROP POLICY IF EXISTS "Allow admin manage all" ON public.withdrawal_methods;
CREATE POLICY "Allow admin manage all" ON public.withdrawal_methods
    FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default methods
INSERT INTO public.withdrawal_methods (id, name, is_active) VALUES
('bank_transfer', 'Bank Transfer', true),
('crypto', 'Cryptocurrency', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Add method_id, wallet_address, and crypto_coin to withdrawal_requests
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS method_id TEXT REFERENCES public.withdrawal_methods(id);
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS crypto_coin TEXT;

-- Update existing requests to default method_id
UPDATE public.withdrawal_requests SET method_id = 'bank_transfer' WHERE method_id IS NULL;
ALTER TABLE public.withdrawal_requests ALTER COLUMN method_id SET NOT NULL;
ALTER TABLE public.withdrawal_requests ALTER COLUMN method_id SET DEFAULT 'bank_transfer';

-- Ensure status default is 'pending'
ALTER TABLE public.withdrawal_requests ALTER COLUMN status SET DEFAULT 'pending'::public.request_status;

-- Migrate existing requests in status 'approved' to 'completed'
UPDATE public.withdrawal_requests SET status = 'completed'::public.request_status WHERE status::text = 'approved';
UPDATE public.transactions SET status = 'completed'::public.request_status WHERE type = 'withdrawal' AND status::text = 'approved';

-- Drop old function overloads if any
DROP FUNCTION IF EXISTS public.approve_withdrawal_bank_admin(uuid);
DROP FUNCTION IF EXISTS public.process_nowpayments_payout_webhook(uuid, text);

-- Simplified manual submit_withdrawal RPC function
CREATE OR REPLACE FUNCTION public.submit_withdrawal(
  p_amount numeric,
  p_method_id text DEFAULT 'bank_transfer',
  p_bank_account_id uuid DEFAULT NULL,
  p_wallet_address text DEFAULT NULL,
  p_crypto_coin text DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _bal numeric;
  _pending_withdrawn numeric;
  _available_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
  _credit_score integer;
  _fee_pct numeric;
  _fee numeric;
  _total_deposited numeric;
  _min_withdrawal numeric;
  _withdrawal_id uuid;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate method status
  IF NOT EXISTS (SELECT 1 FROM public.withdrawal_methods WHERE id = p_method_id AND is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected withdrawal method is not active');
  END IF;

  -- Validate fields based on method type
  IF p_method_id = 'bank_transfer' AND p_bank_account_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bank account is required for bank transfer');
  END IF;

  IF p_method_id = 'crypto' AND (p_wallet_address IS NULL OR p_crypto_coin IS NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet address and crypto coin are required for crypto transfer');
  END IF;

  -- Fetch profile details
  SELECT is_frozen, credit_score INTO _is_frozen, _credit_score FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  _credit_score := COALESCE(_credit_score, 100);

  -- Package verification
  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  -- Deposit limit verification
  SELECT total_deposited INTO _total_deposited FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_total_deposited, 0) < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must deposit at least Rs 500 before withdrawing');
  END IF;

  -- Min withdrawal check based on credit score
  _min_withdrawal := 1000 + ((100 - _credit_score) * 50);
  IF p_amount < _min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs ' || _min_withdrawal::text || ' (credit score: ' || _credit_score || '%)');
  END IF;

  -- Fee details
  _fee_pct := 5.0 + ((100 - _credit_score) * 0.1);
  _fee := ROUND((p_amount * _fee_pct / 100)::numeric, 2);

  -- Double spending safety check: verify available balance
  SELECT COALESCE(SUM(amount), 0) INTO _pending_withdrawn 
  FROM public.withdrawal_requests 
  WHERE user_id = _user_id AND status = 'pending';

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  _available_bal := _bal - _pending_withdrawn;
  IF _available_bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient available balance. Pending withdrawals are locked.');
  END IF;

  -- Insert withdrawal request with status 'pending'
  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id, method_id, wallet_address, crypto_coin, status)
  VALUES (_user_id, p_amount, p_bank_account_id, p_method_id, p_wallet_address, p_crypto_coin, 'pending')
  RETURNING id INTO _withdrawal_id;

  -- Insert pending transaction log
  INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 
    'Withdrawal request (' || p_method_id || ') (Fee: ' || _fee_pct || '% = Rs ' || _fee::text || ')', _withdrawal_id);

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' via ' || p_method_id || ' is pending. Handling fee: ' || _fee_pct || '% (Rs ' || _fee::text || ').');

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _withdrawal_id, 'amount', p_amount, 'fee_pct', _fee_pct, 'fee', _fee);
END;
$function$;

-- Unified manual withdrawal approval RPC function (for bank or crypto)
CREATE OR REPLACE FUNCTION public.approve_withdrawal_admin(p_withdrawal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _req record;
  _bal numeric;
  _new_bal numeric;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF _req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request is not pending');
  END IF;

  -- Lock and check wallet balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _req.user_id FOR UPDATE;
  IF _bal < _req.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'User has insufficient balance to complete this withdrawal');
  END IF;

  -- Deduct wallet balance
  UPDATE public.wallets 
  SET balance = balance - _req.amount,
      total_withdrawn = total_withdrawn + _req.amount,
      updated_at = now() 
  WHERE user_id = _req.user_id;

  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _req.user_id;

  -- Update request status to completed
  UPDATE public.withdrawal_requests 
  SET status = 'completed', updated_at = now() 
  WHERE id = p_withdrawal_id;

  -- Update transaction logs
  UPDATE public.transactions 
  SET status = 'approved', description = 'Withdrawal processed and completed manually by admin', reference_id = p_withdrawal_id
  WHERE reference_id = p_withdrawal_id OR (user_id = _req.user_id AND type = 'withdrawal' AND status = 'pending' AND amount = _req.amount AND reference_id IS NULL);

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_req.user_id, 'money', 'Withdrawal Approved ✅',
    'Your withdrawal of Rs ' || _req.amount::text || ' (' || _req.method_id || ') has been manually processed and completed successfully.');

  RETURN jsonb_build_object('success', true, 'new_balance', _new_bal);
END;
$function$;

-- Updated rejection RPC function (works for bank and crypto requests)
CREATE OR REPLACE FUNCTION public.reject_withdrawal_admin(p_withdrawal_id uuid, p_notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _req record;
  _credit_score integer;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _req FROM public.withdrawal_requests WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found');
  END IF;

  IF _req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request is not pending');
  END IF;

  -- Update request status to rejected
  UPDATE public.withdrawal_requests 
  SET status = 'rejected', notes = COALESCE(p_notes, notes), updated_at = now() 
  WHERE id = p_withdrawal_id;

  -- Update transaction logs
  UPDATE public.transactions 
  SET status = 'rejected', description = COALESCE(p_notes, 'Withdrawal rejected manually by admin')
  WHERE reference_id = p_withdrawal_id OR (user_id = _req.user_id AND type = 'withdrawal' AND status = 'pending' AND amount = _req.amount AND reference_id IS NULL);

  -- Decrease credit score by 10 points on rejection
  SELECT credit_score INTO _credit_score FROM public.profiles WHERE user_id = _req.user_id;
  IF _credit_score IS NOT NULL THEN
    UPDATE public.profiles 
    SET credit_score = GREATEST(0, _credit_score - 10) 
    WHERE user_id = _req.user_id;
  END IF;

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_req.user_id, 'money', 'Withdrawal Rejected ❌',
    'Your withdrawal of Rs ' || _req.amount::text || ' was rejected. ' || COALESCE(p_notes, 'The amount remains in your balance. Please check details.'));

  RETURN jsonb_build_object('success', true);
END;
$function$;
