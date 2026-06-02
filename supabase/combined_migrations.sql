-- =========================================================================
-- CONSOLIDATED SUPABASE MIGRATIONS
-- Generated on 2026-05-31T23:22:56.257Z
-- Total files: 46
-- =========================================================================

-- ========================================== 
-- START MIGRATION: 20260217074447_81a32a7c-3dde-41c9-81f7-cf1dcc6984fc.sql
-- ========================================== 


-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    display_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Wallets table
CREATE TABLE public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_deposited DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_withdrawn DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_commission DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Bank accounts
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    iban TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- Deposit requests
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.payment_method AS ENUM ('bank_transfer', 'crypto', 'credit_card');

CREATE TABLE public.deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    payment_method payment_method NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deposit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deposits" ON public.deposit_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create deposits" ON public.deposit_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Withdrawal requests
CREATE TABLE public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id),
    status request_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create withdrawals" ON public.withdrawal_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- AI Packages
CREATE TABLE public.ai_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    features JSONB NOT NULL DEFAULT '[]',
    price_onetime DECIMAL(12,2),
    price_monthly DECIMAL(12,2),
    cashback_percent DECIMAL(5,2) DEFAULT 0,
    bonus_tag TEXT,
    duration_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active packages" ON public.ai_packages FOR SELECT USING (is_active = true);

-- User packages (purchases)
CREATE TABLE public.user_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.ai_packages(id) NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    price_paid DECIMAL(12,2) NOT NULL
);
ALTER TABLE public.user_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own packages" ON public.user_packages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own packages" ON public.user_packages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions (unified log)
CREATE TYPE public.transaction_type AS ENUM ('deposit', 'withdrawal', 'purchase', 'commission', 'refund');

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type transaction_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status request_status NOT NULL DEFAULT 'pending',
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Referrals
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    referred_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tier INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(referrer_id, referred_id)
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Commissions
CREATE TABLE public.commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    from_user_id UUID REFERENCES auth.users(id),
    tier INTEGER NOT NULL DEFAULT 1,
    amount DECIMAL(12,2) NOT NULL,
    source_type TEXT,
    source_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own commissions" ON public.commissions FOR SELECT USING (auth.uid() = user_id);

-- Function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    code TEXT;
BEGIN
    code := upper(substring(md5(random()::text) from 1 for 8));
    RETURN code;
END;
$$;

-- Trigger to create profile + wallet + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, display_name, referral_code)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), public.generate_referral_code());

    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deposit_requests_updated_at BEFORE UPDATE ON public.deposit_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ========================================== 
-- START MIGRATION: 20260217074501_3065f62a-6a0f-4612-94d8-01fba6399272.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    code TEXT;
BEGIN
    code := upper(substring(md5(random()::text) from 1 for 8));
    RETURN code;
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260217085348_ab4fe6d5-cdff-4a56-936a-6da93e993bcd.sql
-- ========================================== 


-- Admin can SELECT all rows in all relevant tables
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all wallets"
ON public.wallets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all wallets"
ON public.wallets FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all deposit_requests"
ON public.deposit_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update deposit_requests"
ON public.deposit_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all withdrawal_requests"
ON public.withdrawal_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update withdrawal_requests"
ON public.withdrawal_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert transactions"
ON public.transactions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update transactions"
ON public.transactions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all user_packages"
ON public.user_packages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user_packages"
ON public.user_packages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all commissions"
ON public.commissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all referrals"
ON public.referrals FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all bank_accounts"
ON public.bank_accounts FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all user_roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage ai_packages"
ON public.ai_packages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ========================================== 
-- START MIGRATION: 20260217091447_6c1bded1-d509-4d1d-b406-1de4cab54d04.sql
-- ========================================== 


-- Drop restrictive policies on user_roles
DROP POLICY IF EXISTS "Admins can view all user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Recreate as PERMISSIVE (default)
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));


-- ========================================== 
-- START MIGRATION: 20260217120358_1d993a93-1dae-4170-a125-6902437ec165.sql
-- ========================================== 


-- 1. Slider banners (admin-editable)
CREATE TABLE public.slider_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  gradient text NOT NULL DEFAULT 'from-yellow-500 via-red-500 to-orange-500',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.slider_banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active banners" ON public.slider_banners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage banners" ON public.slider_banners FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Notifications table (per-user, real)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  description text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Daily sign-ins table
CREATE TABLE public.daily_signins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  signed_in_date date NOT NULL DEFAULT CURRENT_DATE,
  reward_amount numeric NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, signed_in_date)
);
ALTER TABLE public.daily_signins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own signins" ON public.daily_signins FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own signins" ON public.daily_signins FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Redeem codes table (admin-managed)
CREATE TABLE public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  reward_amount numeric NOT NULL DEFAULT 0,
  max_uses integer NOT NULL DEFAULT 1,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage redeem codes" ON public.redeem_codes FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view active codes" ON public.redeem_codes FOR SELECT USING (is_active = true);

-- Redeem code usage tracking
CREATE TABLE public.redeem_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.redeem_codes(id),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(code_id, user_id)
);
ALTER TABLE public.redeem_code_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redemptions" ON public.redeem_code_uses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own redemptions" ON public.redeem_code_uses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Add is_frozen and credit_score to profiles
ALTER TABLE public.profiles ADD COLUMN is_frozen boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN credit_score integer NOT NULL DEFAULT 100;


-- ========================================== 
-- START MIGRATION: 20260217123044_d81a6fa8-3f63-4c09-b7e8-c0fc7d7ed84f.sql
-- ========================================== 

-- Add image_url column to slider_banners for uploaded images
ALTER TABLE public.slider_banners ADD COLUMN image_url text;

-- Add slip_url column to deposit_requests for payment slip uploads
ALTER TABLE public.deposit_requests ADD COLUMN slip_url text;

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

-- Storage policies: anyone can view
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- Admins can delete
CREATE POLICY "Admins can delete uploads" ON storage.objects FOR DELETE USING (bucket_id = 'uploads' AND public.has_role(auth.uid(), 'admin'));

-- Users can update own uploads
CREATE POLICY "Users can update own uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- ========================================== 
-- START MIGRATION: 20260217154306_1425460c-1304-4aa5-9ec8-52bd58d2edb9.sql
-- ========================================== 


-- 1. Allow users to delete their own notifications (for Clear All feature)
CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- 2. Platform settings table for admin-configurable values (deposit bank info, commission rates, etc.)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
ON public.platform_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage platform settings"
ON public.platform_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default deposit bank details
INSERT INTO public.platform_settings (key, value) VALUES
('deposit_bank', '{"bank_name": "Commercial Bank PLC", "account_name": "AI Cloud Technologies", "account_number": "82001567XX", "branch": "Colombo 07"}'::jsonb),
('commission_rates', '{"level_1": 10, "level_2": 5, "level_3": 2}'::jsonb);

-- 3. Device logs table for fraud detection (track IP, browser fingerprint, device)
CREATE TABLE public.device_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ip_address text,
  user_agent text,
  fingerprint text,
  event_type text NOT NULL DEFAULT 'login',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.device_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all device logs"
ON public.device_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own device logs"
ON public.device_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Admin alerts table for fraud warnings
CREATE TABLE public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  description text,
  related_user_ids uuid[] DEFAULT '{}',
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alerts"
ON public.admin_alerts
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- ========================================== 
-- START MIGRATION: 20260217165315_c52d50ff-4f64-4775-9074-89a8b034133c.sql
-- ========================================== 


CREATE POLICY "Admins can insert user_roles"
ON public.user_roles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user_roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user_roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));


-- ========================================== 
-- START MIGRATION: 20260217170548_26f6e056-a71d-426c-b766-1859d35b1856.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _referral_code TEXT;
    _referrer_id UUID;
    _referrer_referrer_id UUID;
    _tier2_referrer_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, display_name, referral_code)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), public.generate_referral_code());

    -- Create wallet
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);

    -- Create user role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    -- Process referral code
    _referral_code := NEW.raw_user_meta_data->>'referral_code';
    IF _referral_code IS NOT NULL AND _referral_code != '' THEN
        -- Find referrer by their referral_code
        SELECT user_id INTO _referrer_id
        FROM public.profiles
        WHERE referral_code = _referral_code
        LIMIT 1;

        IF _referrer_id IS NOT NULL THEN
            -- Set referred_by on the new user's profile
            UPDATE public.profiles SET referred_by = _referrer_id WHERE user_id = NEW.id;

            -- Insert tier 1 referral
            INSERT INTO public.referrals (referrer_id, referred_id, tier)
            VALUES (_referrer_id, NEW.id, 1);

            -- Check for tier 2 (referrer's referrer)
            SELECT referred_by INTO _referrer_referrer_id
            FROM public.profiles
            WHERE user_id = _referrer_id;

            IF _referrer_referrer_id IS NOT NULL THEN
                INSERT INTO public.referrals (referrer_id, referred_id, tier)
                VALUES (_referrer_referrer_id, NEW.id, 2);

                -- Check for tier 3
                SELECT referred_by INTO _tier2_referrer_id
                FROM public.profiles
                WHERE user_id = _referrer_referrer_id;

                IF _tier2_referrer_id IS NOT NULL THEN
                    INSERT INTO public.referrals (referrer_id, referred_id, tier)
                    VALUES (_tier2_referrer_id, NEW.id, 3);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260217171436_048bb3d4-86a1-4b46-9133-097d17e1127c.sql
-- ========================================== 

-- Allow admins to insert commissions (for deposit commission distribution)
CREATE POLICY "Admins can insert commissions"
ON public.commissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


-- ========================================== 
-- START MIGRATION: 20260217172417_ff44e9c1-4596-4d18-a7dc-c7388f891315.sql
-- ========================================== 


-- Secure atomic package purchase function
CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _expires_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get package
  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  -- Get wallet balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate expiry
  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  -- Deduct balance
  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Create user package
  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  -- Create transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  -- Create user notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased',
    'You successfully purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Daily income will be added automatically.');

  -- Alert admin about the purchase
  INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
  VALUES ('package_purchase', 'info', 'Package Purchased',
    'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Balance before: Rs ' || _bal::text || ', after: Rs ' || (_bal - _price)::text,
    ARRAY[_user_id]);

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name);
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260217174934_971c783a-0ea9-4d3f-b1f6-c24ff25a121a.sql
-- ========================================== 


-- Atomic daily check-in function (fixes wallet not updating due to missing RLS UPDATE policy)
CREATE OR REPLACE FUNCTION public.daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _today date;
  _reward numeric := 10;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := CURRENT_DATE;

  -- Check if already signed in
  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  -- Insert sign-in record
  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _reward);

  -- Credit wallet
  UPDATE public.wallets SET balance = balance + _reward, updated_at = now() WHERE user_id = _user_id;

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward', 'You received Rs 10 for your daily check-in. Keep your streak going!');

  RETURN jsonb_build_object('success', true, 'reward', _reward);
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260217175047_dc5273c0-9243-46b9-936b-0fe65afafa5c.sql
-- ========================================== 


-- Update purchase_package to include integrity checks
CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Verify balance after deduction
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased',
    'You successfully purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Daily income will be added automatically.');

  -- Integrity check: verify balance math
  IF abs(_new_bal - (_bal - _price)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Expected balance: Rs ' || (_bal - _price)::text || ', Actual: Rs ' || _new_bal::text || '. Possible concurrent transaction.',
      ARRAY[_user_id]);
  ELSE
    -- Normal purchase alert
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('package_purchase', 'info', 'Package Purchased ✅',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Balance: Rs ' || _bal::text || ' → Rs ' || _new_bal::text || '. Verified OK.',
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name);
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260217180214_04b4b99c-6d0f-4827-9c22-806c33169277.sql
-- ========================================== 


-- Create atomic withdrawal RPC that handles balance deduction securely
CREATE OR REPLACE FUNCTION public.submit_withdrawal(p_amount numeric, p_bank_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _bal numeric;
  _new_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check frozen
  SELECT is_frozen INTO _is_frozen FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  -- Check active package
  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  IF p_amount < 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs 1,000');
  END IF;

  -- Lock wallet row and check balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Deduct balance
  UPDATE public.wallets SET balance = balance - p_amount, updated_at = now() WHERE user_id = _user_id;

  -- Verify deduction
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  -- Create withdrawal request
  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id)
  VALUES (_user_id, p_amount, p_bank_account_id);

  -- Create transaction record
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 'Withdrawal request');

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' is pending admin approval.');

  -- Integrity check
  IF abs(_new_bal - (_bal - p_amount)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Withdrawal',
      'User withdrew Rs ' || p_amount::text || '. Expected: Rs ' || (_bal - p_amount)::text || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', p_amount);
END;
$$;

-- Also update purchase_package to only alert on integrity errors (remove normal purchase alert)
CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased',
    'You successfully purchased ' || _pkg.name || ' for Rs ' || _price::text || '.');

  -- ONLY alert admin if integrity error detected
  IF abs(_new_bal - (_bal - _price)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Expected: Rs ' || (_bal - _price)::text || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name);
END;
$$;

-- Enable realtime for admin_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_alerts;


-- ========================================== 
-- START MIGRATION: 20260217181453_9da5c5a3-ed1e-48c4-b453-8772304707c9.sql
-- ========================================== 


-- 1. Atomic deposit approval RPC
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dep record;
  _bal numeric;
  _new_bal numeric;
  _caller_id uuid;
  _display_name text;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify admin
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Get deposit
  SELECT * INTO _dep FROM public.deposit_requests WHERE id = p_deposit_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
  END IF;
  IF _dep.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already processed');
  END IF;

  -- Get user display name
  SELECT display_name INTO _display_name FROM public.profiles WHERE user_id = _dep.user_id;

  -- Lock wallet and get balance
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _dep.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Update deposit status
  UPDATE public.deposit_requests SET status = 'approved', updated_at = now() WHERE id = p_deposit_id;

  -- Credit wallet
  UPDATE public.wallets SET balance = balance + _dep.amount, total_deposited = total_deposited + _dep.amount, updated_at = now() WHERE user_id = _dep.user_id;

  -- Verify balance
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _dep.user_id;

  -- Update/insert transaction
  UPDATE public.transactions SET status = 'approved', description = 'Deposit approved by admin'
    WHERE user_id = _dep.user_id AND type = 'deposit' AND status = 'pending' AND reference_id = p_deposit_id;
  IF NOT FOUND THEN
    INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
    VALUES (_dep.user_id, 'deposit', _dep.amount, 'approved', 'Deposit approved by admin', p_deposit_id);
  END IF;

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_dep.user_id, 'money', 'Deposit Approved ✅',
    'Your deposit of Rs ' || _dep.amount::text || ' has been approved and credited to your wallet.');

  -- Integrity check
  IF abs(_new_bal - (_bal + _dep.amount)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Deposit Approval',
      'Deposit Rs ' || _dep.amount::text || ' for ' || COALESCE(_display_name, 'User') || '. Expected: Rs ' || (_bal + _dep.amount)::text || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_dep.user_id]);
  END IF;

  -- Distribute referral commissions
  DECLARE
    _rates jsonb;
    _ref record;
    _rate numeric;
    _comm_amount numeric;
    _r_bal numeric;
  BEGIN
    SELECT value INTO _rates FROM public.platform_settings WHERE key = 'commission_rates';
    IF _rates IS NOT NULL THEN
      FOR _ref IN SELECT referrer_id, tier FROM public.referrals WHERE referred_id = _dep.user_id LOOP
        _rate := CASE _ref.tier
          WHEN 1 THEN COALESCE((_rates->>'level_1')::numeric, 0)
          WHEN 2 THEN COALESCE((_rates->>'level_2')::numeric, 0)
          WHEN 3 THEN COALESCE((_rates->>'level_3')::numeric, 0)
          ELSE 0
        END;
        IF _rate <= 0 THEN CONTINUE; END IF;
        _comm_amount := (_dep.amount * _rate) / 100;

        INSERT INTO public.commissions (user_id, amount, tier, from_user_id, source_type, source_id)
        VALUES (_ref.referrer_id, _comm_amount, _ref.tier, _dep.user_id, 'deposit', p_deposit_id);

        UPDATE public.wallets SET balance = balance + _comm_amount, total_commission = total_commission + _comm_amount, updated_at = now()
        WHERE user_id = _ref.referrer_id;

        INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
        VALUES (_ref.referrer_id, 'commission', _comm_amount, 'approved', 'Tier ' || _ref.tier || ' commission from deposit', p_deposit_id);

        INSERT INTO public.notifications (user_id, type, title, description)
        VALUES (_ref.referrer_id, 'money', 'Commission Earned 🎉',
          'You earned Rs ' || _comm_amount::text || ' (Tier ' || _ref.tier || ') from a team member''s deposit.');
      END LOOP;
    END IF;
  END;

  RETURN jsonb_build_object('success', true, 'amount', _dep.amount, 'user_id', _dep.user_id, 'balance_before', _bal, 'balance_after', _new_bal);
END;
$$;

-- 2. Add ban_count to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_count integer NOT NULL DEFAULT 0;

-- 3. Add privacy_accepted to profiles  
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp with time zone;


-- ========================================== 
-- START MIGRATION: 20260217185433_38aef347-275f-469b-a05f-28ca84fd7f69.sql
-- ========================================== 


-- =============================================
-- 1. Ban user with credit score cascade to team
-- =============================================
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  -- Self penalty: 20% per ban (escalating)
  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  -- Freeze and update credit score
  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit 
  WHERE user_id = p_user_id;

  -- Notify banned user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || '). Credit score decreased to ' || _new_credit || '%. Withdrawals are disabled.');

  -- Team impact: ban_count * 3% for tier 1, ban_count * 2% for tier 2, ban_count * 1% for tier 3
  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned. Credit score affects your commissions, fees, and daily rewards.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'ban_count', _new_ban_count, 'new_credit_score', _new_credit);
END;
$$;

-- =============================================
-- 2. Update daily_checkin to factor credit score
-- =============================================
CREATE OR REPLACE FUNCTION public.daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _today date;
  _base_reward numeric := 10;
  _credit_score integer;
  _actual_reward numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := CURRENT_DATE;

  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  SELECT credit_score INTO _credit_score FROM public.profiles WHERE user_id = _user_id;
  _credit_score := COALESCE(_credit_score, 100);

  -- Reward scaled by credit score
  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _actual_reward);

  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward',
    'You received Rs ' || _actual_reward::text || ' for your daily check-in.' ||
    CASE WHEN _credit_score < 100 THEN ' (Reduced due to ' || _credit_score || '% credit score)' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'reward', _actual_reward, 'credit_score', _credit_score);
END;
$$;

-- =============================================
-- 3. Update submit_withdrawal: handling fee increases with low credit score
--    Base 5% + (100 - credit_score) * 0.1%
-- =============================================
CREATE OR REPLACE FUNCTION public.submit_withdrawal(p_amount numeric, p_bank_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _bal numeric;
  _new_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
  _credit_score integer;
  _fee_pct numeric;
  _fee numeric;
  _net numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_frozen, credit_score INTO _is_frozen, _credit_score FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  _credit_score := COALESCE(_credit_score, 100);

  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  IF p_amount < 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs 1,000');
  END IF;

  -- Fee increases with lower credit score: base 5% + penalty
  _fee_pct := 5.0 + ((100 - _credit_score) * 0.1);
  _fee := ROUND((p_amount * _fee_pct / 100)::numeric, 2);
  _net := p_amount;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _net THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets SET balance = balance - _net, updated_at = now() WHERE user_id = _user_id;
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id)
  VALUES (_user_id, p_amount, p_bank_account_id);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 
    'Withdrawal request (Fee: ' || _fee_pct || '% = Rs ' || _fee::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' is pending. Handling fee: ' || _fee_pct || '% (Rs ' || _fee::text || ').' ||
    CASE WHEN _credit_score < 100 THEN ' Fee increased due to ' || _credit_score || '% credit score.' ELSE '' END);

  IF abs(_new_bal - (_bal - _net)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Withdrawal',
      'Expected: Rs ' || (_bal - _net)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee_pct', _fee_pct, 'fee', _fee, 'credit_score', _credit_score);
END;
$$;

-- =============================================
-- 4. Update approve_deposit: commissions scaled by credit score
-- =============================================
CREATE OR REPLACE FUNCTION public.approve_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dep record;
  _bal numeric;
  _new_bal numeric;
  _caller_id uuid;
  _display_name text;
BEGIN
  _caller_id := auth.uid();
  IF _caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _dep FROM public.deposit_requests WHERE id = p_deposit_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Deposit not found'); END IF;
  IF _dep.status != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Already processed'); END IF;

  SELECT display_name INTO _display_name FROM public.profiles WHERE user_id = _dep.user_id;
  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _dep.user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wallet not found'); END IF;

  UPDATE public.deposit_requests SET status = 'approved', updated_at = now() WHERE id = p_deposit_id;
  UPDATE public.wallets SET balance = balance + _dep.amount, total_deposited = total_deposited + _dep.amount, updated_at = now() WHERE user_id = _dep.user_id;
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _dep.user_id;

  UPDATE public.transactions SET status = 'approved', description = 'Deposit approved by admin'
    WHERE user_id = _dep.user_id AND type = 'deposit' AND status = 'pending' AND reference_id = p_deposit_id;
  IF NOT FOUND THEN
    INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
    VALUES (_dep.user_id, 'deposit', _dep.amount, 'approved', 'Deposit approved by admin', p_deposit_id);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_dep.user_id, 'money', 'Deposit Approved ✅',
    'Your deposit of Rs ' || _dep.amount::text || ' has been approved and credited.');

  IF abs(_new_bal - (_bal + _dep.amount)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Deposit',
      'Expected: Rs ' || (_bal + _dep.amount)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_dep.user_id]);
  END IF;

  -- Distribute referral commissions scaled by earner's credit score
  DECLARE
    _rates jsonb;
    _ref record;
    _rate numeric;
    _comm_amount numeric;
    _earner_credit integer;
  BEGIN
    SELECT value INTO _rates FROM public.platform_settings WHERE key = 'commission_rates';
    IF _rates IS NOT NULL THEN
      FOR _ref IN SELECT referrer_id, tier FROM public.referrals WHERE referred_id = _dep.user_id LOOP
        _rate := CASE _ref.tier
          WHEN 1 THEN COALESCE((_rates->>'level_1')::numeric, 0)
          WHEN 2 THEN COALESCE((_rates->>'level_2')::numeric, 0)
          WHEN 3 THEN COALESCE((_rates->>'level_3')::numeric, 0)
          ELSE 0
        END;
        IF _rate <= 0 THEN CONTINUE; END IF;

        -- Scale commission by earner's credit score
        SELECT credit_score INTO _earner_credit FROM public.profiles WHERE user_id = _ref.referrer_id;
        _earner_credit := COALESCE(_earner_credit, 100);
        
        _comm_amount := ROUND((_dep.amount * _rate / 100 * _earner_credit / 100)::numeric, 2);
        IF _comm_amount < 0.01 THEN CONTINUE; END IF;

        INSERT INTO public.commissions (user_id, amount, tier, from_user_id, source_type, source_id)
        VALUES (_ref.referrer_id, _comm_amount, _ref.tier, _dep.user_id, 'deposit', p_deposit_id);

        UPDATE public.wallets SET balance = balance + _comm_amount, total_commission = total_commission + _comm_amount, updated_at = now()
        WHERE user_id = _ref.referrer_id;

        INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
        VALUES (_ref.referrer_id, 'commission', _comm_amount, 'approved', 
          'Tier ' || _ref.tier || ' commission' || CASE WHEN _earner_credit < 100 THEN ' (Credit: ' || _earner_credit || '%)' ELSE '' END, p_deposit_id);

        INSERT INTO public.notifications (user_id, type, title, description)
        VALUES (_ref.referrer_id, 'money', 'Commission Earned 🎉',
          'You earned Rs ' || _comm_amount::text || ' (Tier ' || _ref.tier || ')' ||
          CASE WHEN _earner_credit < 100 THEN '. Reduced due to ' || _earner_credit || '% credit score.' ELSE '' END);
      END LOOP;
    END IF;
  END;

  RETURN jsonb_build_object('success', true, 'amount', _dep.amount, 'user_id', _dep.user_id);
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260217190618_1bc74648-ead0-4b60-b527-aa2d10ea9545.sql
-- ========================================== 


-- 1. Update daily_checkin to recover credit score (+1 per day if not frozen, max 100)
CREATE OR REPLACE FUNCTION public.daily_checkin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _today date;
  _base_reward numeric := 10;
  _credit_score integer;
  _actual_reward numeric;
  _is_frozen boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := CURRENT_DATE;

  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  SELECT credit_score, is_frozen INTO _credit_score, _is_frozen FROM public.profiles WHERE user_id = _user_id;
  _credit_score := COALESCE(_credit_score, 100);

  IF COALESCE(_is_frozen, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  -- Credit score recovery: +1 per daily check-in (good behavior), max 100
  IF _credit_score < 100 THEN
    UPDATE public.profiles SET credit_score = LEAST(100, credit_score + 1) WHERE user_id = _user_id;
    _credit_score := LEAST(100, _credit_score + 1);
  END IF;

  -- Reward scaled by credit score
  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _actual_reward);

  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward',
    'You received Rs ' || _actual_reward::text || ' for your daily check-in.' ||
    CASE WHEN _credit_score < 100 THEN ' Credit score recovered to ' || _credit_score || '%.' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'reward', _actual_reward, 'credit_score', _credit_score);
END;
$function$;

-- 2. Update submit_withdrawal to require minimum Rs 500 total deposits
CREATE OR REPLACE FUNCTION public.submit_withdrawal(p_amount numeric, p_bank_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _bal numeric;
  _new_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
  _credit_score integer;
  _fee_pct numeric;
  _fee numeric;
  _net numeric;
  _total_deposited numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_frozen, credit_score INTO _is_frozen, _credit_score FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  _credit_score := COALESCE(_credit_score, 100);

  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  -- Check minimum deposit requirement
  SELECT total_deposited INTO _total_deposited FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_total_deposited, 0) < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must deposit at least Rs 500 before withdrawing');
  END IF;

  IF p_amount < 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs 1,000');
  END IF;

  _fee_pct := 5.0 + ((100 - _credit_score) * 0.1);
  _fee := ROUND((p_amount * _fee_pct / 100)::numeric, 2);
  _net := p_amount;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _net THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets SET balance = balance - _net, updated_at = now() WHERE user_id = _user_id;
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id)
  VALUES (_user_id, p_amount, p_bank_account_id);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 
    'Withdrawal request (Fee: ' || _fee_pct || '% = Rs ' || _fee::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' is pending. Handling fee: ' || _fee_pct || '% (Rs ' || _fee::text || ').' ||
    CASE WHEN _credit_score < 100 THEN ' Fee increased due to ' || _credit_score || '% credit score.' ELSE '' END);

  IF abs(_new_bal - (_bal - _net)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Withdrawal',
      'Expected: Rs ' || (_bal - _net)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee_pct', _fee_pct, 'fee', _fee, 'credit_score', _credit_score);
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260217190719_1f6e7a53-44e5-4ebb-bcf5-b137ea339ada.sql
-- ========================================== 


-- Add enhanced fingerprint columns to device_logs
ALTER TABLE public.device_logs 
  ADD COLUMN IF NOT EXISTS canvas_hash text,
  ADD COLUMN IF NOT EXISTS webgl_hash text,
  ADD COLUMN IF NOT EXISTS audio_hash text,
  ADD COLUMN IF NOT EXISTS screen_info text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS fonts_hash text;

-- Create index for fast duplicate detection
CREATE INDEX IF NOT EXISTS idx_device_logs_fingerprint ON public.device_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_device_logs_canvas_webgl ON public.device_logs(canvas_hash, webgl_hash);
CREATE INDEX IF NOT EXISTS idx_device_logs_ip ON public.device_logs(ip_address);


-- ========================================== 
-- START MIGRATION: 20260218005713_d8f168c5-acb1-41ac-8a2f-ab3e8a726fdb.sql
-- ========================================== 


-- Create a function to auto-credit daily package income
CREATE OR REPLACE FUNCTION public.claim_package_daily_income()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _today date;
  _today_start timestamptz;
  _today_end timestamptz;
  _already_claimed boolean;
  _total_income numeric := 0;
  _pkg record;
  _income numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := CURRENT_DATE;
  _today_start := _today::timestamptz;
  _today_end := _today_start + interval '1 day';

  -- Check if already claimed today
  SELECT EXISTS(
    SELECT 1 FROM public.transactions
    WHERE user_id = _user_id
      AND type = 'commission'
      AND description LIKE 'Daily package income%'
      AND created_at >= _today_start
      AND created_at < _today_end
  ) INTO _already_claimed;

  IF _already_claimed THEN
    RETURN jsonb_build_object('success', false, 'already_claimed', true, 'error', 'Already claimed today');
  END IF;

  -- Sum income from all active, non-expired packages (5% of price_paid per day)
  FOR _pkg IN
    SELECT id, price_paid FROM public.user_packages
    WHERE user_id = _user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    _income := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
    _total_income := _total_income + _income;
  END LOOP;

  IF _total_income <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active packages');
  END IF;

  -- Credit wallet
  UPDATE public.wallets
  SET balance = balance + _total_income,
      total_commission = total_commission + _total_income,
      updated_at = now()
  WHERE user_id = _user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _total_income, 'approved',
    'Daily package income (Rs ' || _total_income::text || ' from ' || (SELECT COUNT(*) FROM public.user_packages WHERE user_id = _user_id AND is_active = true AND (expires_at IS NULL OR expires_at > now()))::text || ' package(s))');

  -- Send notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', '💰 Daily Package Income Credited',
    'Rs ' || _total_income::text || ' has been credited to your wallet from your active AI packages.');

  RETURN jsonb_build_object('success', true, 'amount', _total_income);
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260218020742_3cd64c5f-d3cb-4fa7-88ed-eed9c4d7cffd.sql
-- ========================================== 

-- Update claim_package_daily_income with:
-- 1. Proper UTC-based date check (consistent with CURRENT_DATE)
-- 2. Balance integrity check with admin alert on mismatch
-- 3. Store balance before/after for audit trail

CREATE OR REPLACE FUNCTION public.claim_package_daily_income()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _today date;
  _today_start timestamptz;
  _today_end timestamptz;
  _already_claimed boolean;
  _total_income numeric := 0;
  _pkg record;
  _income numeric;
  _pkg_count integer := 0;
  _bal_before numeric;
  _bal_after numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Use explicit UTC so DB and client agree on "today"
  _today := (now() AT TIME ZONE 'UTC')::date;
  _today_start := (_today::text || ' 00:00:00+00')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  -- Check if already claimed today (UTC day)
  SELECT EXISTS(
    SELECT 1 FROM public.transactions
    WHERE user_id = _user_id
      AND type = 'commission'
      AND description LIKE 'Daily package income%'
      AND created_at >= _today_start
      AND created_at <  _today_end
  ) INTO _already_claimed;

  IF _already_claimed THEN
    RETURN jsonb_build_object('success', false, 'already_claimed', true, 'error', 'Already claimed today');
  END IF;

  -- Sum income from all active, non-expired packages (5% of price_paid per day)
  FOR _pkg IN
    SELECT id, price_paid FROM public.user_packages
    WHERE user_id = _user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    _income := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
    _total_income := _total_income + _income;
    _pkg_count := _pkg_count + 1;
  END LOOP;

  IF _total_income <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active packages');
  END IF;

  -- Capture balance BEFORE credit for integrity check
  SELECT balance INTO _bal_before FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Credit wallet balance + total_commission
  UPDATE public.wallets
  SET balance          = balance + _total_income,
      total_commission = total_commission + _total_income,
      updated_at       = now()
  WHERE user_id = _user_id;

  -- Capture balance AFTER credit
  SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user_id;

  -- ⚠️ Integrity check: alert admin if mismatch
  IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES (
      'integrity_error', 'critical',
      '⚠️ Balance Mismatch on Daily Package Income',
      'Package income credit mismatch for user. Before: Rs ' || _bal_before::text
        || ', Income: Rs ' || _total_income::text
        || ', Expected After: Rs ' || (_bal_before + _total_income)::text
        || ', Actual After: Rs ' || _bal_after::text,
      ARRAY[_user_id]
    );
  END IF;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (
    _user_id, 'commission', _total_income, 'approved',
    'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
  );

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (
    _user_id, 'money', '💰 Daily Package Income Credited',
    'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
  );

  RETURN jsonb_build_object('success', true, 'amount', _total_income, 'packages', _pkg_count);
END;
$function$;

-- ========================================== 
-- START MIGRATION: 20260218021804_1cc74ce2-974f-4447-aab5-5898771910e1.sql
-- ========================================== 


-- Update purchase_package to:
-- 1. Prevent buying the same package if user already has an active one
-- 2. Credit first day's income (5% of price_paid) immediately upon purchase

CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
  _daily_income numeric;
  _already_owns boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  -- ✅ Prevent duplicate active package purchase
  SELECT EXISTS(
    SELECT 1 FROM public.user_packages
    WHERE user_id = _user_id
      AND package_id = p_package_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _already_owns;

  IF _already_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already own this active package');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  -- Deduct purchase price
  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Insert user package record
  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  -- Log purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  -- ✅ Credit first day's income immediately (5% of price_paid)
  _daily_income := ROUND((_price * 0.05)::numeric, 2);

  UPDATE public.wallets
  SET balance          = balance + _daily_income,
      total_commission = total_commission + _daily_income,
      updated_at       = now()
  WHERE user_id = _user_id;

  -- Log daily income transaction (avoids double-claim since it's a specific package purchase event)
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _daily_income, 'approved',
    'Daily package income (Rs ' || _daily_income::text || ' from 1 package(s))');

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased + Income Credited 💰',
    'You purchased ' || _pkg.name || ' for Rs ' || _price::text || '. First day income of Rs ' || _daily_income::text || ' credited immediately!');

  -- Integrity check after all operations
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;
  IF abs(_new_bal - (_bal - _price + _daily_income)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || ' + income Rs ' || _daily_income::text ||
      '. Expected: Rs ' || (_bal - _price + _daily_income)::text || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name, 'daily_income', _daily_income);
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260218023854_eac7cf7f-e092-430e-ab4f-cf06258b64fe.sql
-- ========================================== 


-- Create a SECURITY DEFINER function that processes daily income for ALL users at midnight
-- This runs server-side (no user session needed) and is called by pg_cron at 00:00 UTC

CREATE OR REPLACE FUNCTION public.process_all_daily_incomes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _today date;
  _today_start timestamptz;
  _today_end   timestamptz;
  _user record;
  _pkg record;
  _income numeric;
  _total_income numeric;
  _pkg_count integer;
  _bal_before numeric;
  _bal_after numeric;
  _users_processed integer := 0;
  _total_credited numeric := 0;
BEGIN
  _today       := (now() AT TIME ZONE 'UTC')::date;
  _today_start := (_today::text || ' 00:00:00+00')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  -- Loop through every user that has at least one active, non-expired package
  FOR _user IN
    SELECT DISTINCT up.user_id
    FROM public.user_packages up
    WHERE up.is_active = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  LOOP
    -- Skip if already received package income today (e.g. purchased today = already got first-day income)
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = _user.user_id
        AND type = 'commission'
        AND description LIKE 'Daily package income%'
        AND created_at >= _today_start
        AND created_at <  _today_end
    ) THEN
      CONTINUE;
    END IF;

    -- Calculate total income from all active packages (5% per package)
    _total_income := 0;
    _pkg_count    := 0;

    FOR _pkg IN
      SELECT id, price_paid FROM public.user_packages
      WHERE user_id = _user.user_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    LOOP
      _income       := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
      _total_income := _total_income + _income;
      _pkg_count    := _pkg_count + 1;
    END LOOP;

    IF _total_income <= 0 THEN
      CONTINUE;
    END IF;

    -- Capture balance before for integrity check
    SELECT balance INTO _bal_before
    FROM public.wallets WHERE user_id = _user.user_id FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;

    -- Credit balance + update total_commission
    UPDATE public.wallets
    SET balance          = balance + _total_income,
        total_commission = total_commission + _total_income,
        updated_at       = now()
    WHERE user_id = _user.user_id;

    SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user.user_id;

    -- Integrity check
    IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES (
        'integrity_error', 'critical',
        '⚠️ Balance Mismatch – Midnight Income Credit',
        'Midnight cron: Before Rs ' || _bal_before::text
          || ', Income Rs ' || _total_income::text
          || ', Expected Rs ' || (_bal_before + _total_income)::text
          || ', Got Rs ' || _bal_after::text,
        ARRAY[_user.user_id]
      );
    END IF;

    -- Record transaction
    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (
      _user.user_id, 'commission', _total_income, 'approved',
      'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
    );

    -- Notify user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (
      _user.user_id, 'money', '💰 Daily Package Income Credited',
      'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
    );

    _users_processed := _users_processed + 1;
    _total_credited  := _total_credited + _total_income;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'users_processed', _users_processed,
    'total_credited', _total_credited,
    'run_at', now()
  );
END;
$$;


-- ========================================== 
-- START MIGRATION: 20260218024803_b207b507-94f6-42c0-a2c7-639b5b6b432a.sql
-- ========================================== 

-- Enable realtime for wallets table so balance updates are pushed instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ========================================== 
-- START MIGRATION: 20260218025351_b94bd68a-655a-4579-b841-0e6cc4a615db.sql
-- ========================================== 

-- Fix purchase_package to actually credit cashback to user balance
CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
  _daily_income numeric;
  _cashback_amt numeric;
  _already_owns boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  -- Prevent duplicate active package purchase
  SELECT EXISTS(
    SELECT 1 FROM public.user_packages
    WHERE user_id = _user_id
      AND package_id = p_package_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _already_owns;

  IF _already_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already own this active package');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  -- Deduct purchase price
  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Insert user package record
  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  -- Log purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  -- Credit first day's income immediately (5% of price_paid)
  _daily_income := ROUND((_price * 0.05)::numeric, 2);
  UPDATE public.wallets
  SET balance = balance + _daily_income,
      total_commission = total_commission + _daily_income,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _daily_income, 'approved',
    'Daily package income (Rs ' || _daily_income::text || ' from 1 package(s))');

  -- Credit cashback if applicable
  _cashback_amt := 0;
  IF COALESCE(_pkg.cashback_percent, 0) > 0 THEN
    _cashback_amt := ROUND((_price * _pkg.cashback_percent / 100)::numeric, 2);
    IF _cashback_amt > 0 THEN
      UPDATE public.wallets
      SET balance = balance + _cashback_amt,
          total_commission = total_commission + _cashback_amt,
          updated_at = now()
      WHERE user_id = _user_id;

      INSERT INTO public.transactions (user_id, type, amount, status, description)
      VALUES (_user_id, 'refund', _cashback_amt, 'approved',
        'Cashback ' || _pkg.cashback_percent::text || '% on ' || _pkg.name || ' (Rs ' || _cashback_amt::text || ')');

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_user_id, 'money', '🎁 Cashback Credited!',
        'Rs ' || _cashback_amt::text || ' cashback (' || _pkg.cashback_percent::text || '%) credited for purchasing ' || _pkg.name || '!');
    END IF;
  END IF;

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased + Income Credited 💰',
    'You purchased ' || _pkg.name || ' for Rs ' || _price::text || '. First day income Rs ' || _daily_income::text ||
    CASE WHEN _cashback_amt > 0 THEN ' + Cashback Rs ' || _cashback_amt::text ELSE '' END || ' credited immediately!');

  -- Integrity check
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;
  IF abs(_new_bal - (_bal - _price + _daily_income + _cashback_amt)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text
        || ' + income Rs ' || _daily_income::text
        || ' + cashback Rs ' || _cashback_amt::text
        || '. Expected: Rs ' || (_bal - _price + _daily_income + _cashback_amt)::text
        || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'price', _price,
    'package_name', _pkg.name,
    'daily_income', _daily_income,
    'cashback', _cashback_amt
  );
END;
$function$;

-- ========================================== 
-- START MIGRATION: 20260218030712_6b33da5b-b474-4ec2-9c49-3f3ad482a255.sql
-- ========================================== 


-- Allow admins to delete user_packages
CREATE POLICY "Admins can delete user_packages"
ON public.user_packages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));


-- ========================================== 
-- START MIGRATION: 20260218032355_9ee921d9-8899-4e6b-aa76-798141211993.sql
-- ========================================== 

ALTER TABLE public.ai_packages ADD COLUMN IF NOT EXISTS stock_count integer DEFAULT NULL;

-- ========================================== 
-- START MIGRATION: 20260218041554_a8beb957-2ad7-4cc9-aadf-26b08ebbb979.sql
-- ========================================== 

-- Add temp ban expiry column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ban_expires_at timestamptz DEFAULT NULL;

-- Update ban_user function to accept optional duration
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
  _ban_expires_at timestamptz;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  -- Calculate ban expiry (NULL = permanent)
  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  -- Self penalty: 20% per ban (escalating)
  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  -- Freeze and update credit score + expiry
  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  -- Notify banned user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.');

  -- Team impact
  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'ban_count', _new_ban_count, 
    'new_credit_score', _new_credit,
    'ban_expires_at', _ban_expires_at,
    'is_temporary', p_duration_hours IS NOT NULL
  );
END;
$function$;

-- Function to auto-unfreeze expired temp bans (can be called periodically)
CREATE OR REPLACE FUNCTION public.process_expired_bans()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user record;
  _unfrozen integer := 0;
BEGIN
  FOR _user IN
    SELECT user_id, display_name FROM public.profiles
    WHERE is_frozen = true 
      AND ban_expires_at IS NOT NULL 
      AND ban_expires_at <= now()
  LOOP
    UPDATE public.profiles 
    SET is_frozen = false, ban_expires_at = NULL 
    WHERE user_id = _user.user_id;

    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_user.user_id, 'security', 'Account Unfrozen ✅',
      'Your temporary ban has expired. Your account is now active again.');

    _unfrozen := _unfrozen + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'unfrozen_count', _unfrozen);
END;
$function$;

-- Function to completely reset all user data (dangerous - requires explicit admin call)
CREATE OR REPLACE FUNCTION public.admin_reset_all_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Delete all user data (cascade will handle most)
  DELETE FROM public.transactions;
  DELETE FROM public.commissions;
  DELETE FROM public.daily_signins;
  DELETE FROM public.device_logs;
  DELETE FROM public.notifications;
  DELETE FROM public.redeem_code_uses;
  DELETE FROM public.referrals;
  DELETE FROM public.user_packages;
  DELETE FROM public.withdrawal_requests;
  DELETE FROM public.deposit_requests;
  DELETE FROM public.bank_accounts;
  DELETE FROM public.wallets;
  DELETE FROM public.admin_alerts;
  DELETE FROM public.user_roles;
  DELETE FROM public.profiles;

  RETURN jsonb_build_object('success', true, 'message', 'All user data has been deleted');
END;
$function$;

-- ========================================== 
-- START MIGRATION: 20260218052448_98c0e18a-e03b-4eb1-b657-55dd1bbe913a.sql
-- ========================================== 

-- Fix admin_reset_all_data to properly handle auth users deletion
-- The issue was that profiles deletion doesn't cascade to auth.users
-- We need to drop and recreate with proper logic

CREATE OR REPLACE FUNCTION public.admin_reset_all_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Delete all transactional / activity data first
  DELETE FROM public.transactions;
  DELETE FROM public.commissions;
  DELETE FROM public.daily_signins;
  DELETE FROM public.device_logs;
  DELETE FROM public.notifications;
  DELETE FROM public.redeem_code_uses;
  DELETE FROM public.referrals;
  DELETE FROM public.user_packages;
  DELETE FROM public.withdrawal_requests;
  DELETE FROM public.deposit_requests;
  DELETE FROM public.bank_accounts;
  DELETE FROM public.wallets;
  DELETE FROM public.admin_alerts;

  -- Delete user roles for non-admin users only (keep current admin session alive)
  DELETE FROM public.user_roles WHERE user_id != _caller_id;

  -- Delete profiles for non-admin users only
  DELETE FROM public.profiles WHERE user_id != _caller_id;

  RETURN jsonb_build_object('success', true, 'message', 'All user data has been deleted. Admin account preserved.');
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260218095629_6e009d27-051c-42c2-9485-ef12ff79f5db.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.admin_reset_all_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Delete all transactional / activity data first (non-admin users only where applicable)
  DELETE FROM public.transactions WHERE user_id != _caller_id OR true;
  DELETE FROM public.commissions WHERE user_id != _caller_id OR true;
  DELETE FROM public.daily_signins WHERE user_id != _caller_id OR true;
  DELETE FROM public.device_logs WHERE user_id != _caller_id OR true;
  DELETE FROM public.notifications WHERE user_id != _caller_id OR true;
  DELETE FROM public.redeem_code_uses WHERE user_id != _caller_id OR true;
  DELETE FROM public.referrals WHERE referrer_id != _caller_id OR true;
  DELETE FROM public.user_packages WHERE user_id != _caller_id OR true;
  DELETE FROM public.withdrawal_requests WHERE user_id != _caller_id OR true;
  DELETE FROM public.deposit_requests WHERE user_id != _caller_id OR true;
  DELETE FROM public.bank_accounts WHERE user_id != _caller_id OR true;
  DELETE FROM public.wallets WHERE user_id != _caller_id OR true;
  DELETE FROM public.admin_alerts WHERE id IS NOT NULL;

  -- Delete user roles for non-admin users only (keep current admin session alive)
  DELETE FROM public.user_roles WHERE user_id != _caller_id;

  -- Delete profiles for non-admin users only
  DELETE FROM public.profiles WHERE user_id != _caller_id;

  -- Re-create admin wallet so their account stays functional
  INSERT INTO public.wallets (user_id)
  VALUES (_caller_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'message', 'All user data has been deleted. Admin account preserved.');
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260218145959_4f45004d-3e77-4d60-aa85-6011654b137f.sql
-- ========================================== 

ALTER TABLE public.slider_banners ALTER COLUMN title SET DEFAULT '';

-- ========================================== 
-- START MIGRATION: 20260219032227_2060db16-cdac-4364-a4d7-d2d64af7c76b.sql
-- ========================================== 


-- ================================================
-- Fix: Use Asia/Colombo (UTC+5:30) as server timezone
-- Sri Lanka midnight = 18:30 UTC previous day
-- ================================================

-- 1. Fix daily_checkin to use Sri Lanka timezone
CREATE OR REPLACE FUNCTION public.daily_checkin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _today date;
  _base_reward numeric := 10;
  _credit_score integer;
  _actual_reward numeric;
  _is_frozen boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Use Sri Lanka timezone (Asia/Colombo = UTC+5:30)
  _today := (now() AT TIME ZONE 'Asia/Colombo')::date;

  -- Check for duplicate sign-in today (Sri Lanka date)
  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  SELECT credit_score, is_frozen INTO _credit_score, _is_frozen FROM public.profiles WHERE user_id = _user_id;
  _credit_score := COALESCE(_credit_score, 100);

  IF COALESCE(_is_frozen, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  -- Credit score recovery: +1 per daily check-in (good behavior), max 100
  IF _credit_score < 100 THEN
    UPDATE public.profiles SET credit_score = LEAST(100, credit_score + 1) WHERE user_id = _user_id;
    _credit_score := LEAST(100, _credit_score + 1);
  END IF;

  -- Reward scaled by credit score
  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  -- Insert sign-in record using Sri Lanka date
  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _actual_reward);

  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward',
    'You received Rs ' || _actual_reward::text || ' for your daily check-in.' ||
    CASE WHEN _credit_score < 100 THEN ' Credit score recovered to ' || _credit_score || '%.' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'reward', _actual_reward, 'credit_score', _credit_score);
END;
$function$;

-- 2. Fix claim_package_daily_income to use Sri Lanka timezone
CREATE OR REPLACE FUNCTION public.claim_package_daily_income()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _today date;
  _today_start timestamptz;
  _today_end timestamptz;
  _already_claimed boolean;
  _total_income numeric := 0;
  _pkg record;
  _income numeric;
  _pkg_count integer := 0;
  _bal_before numeric;
  _bal_after numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Use Sri Lanka timezone (Asia/Colombo = UTC+5:30)
  _today := (now() AT TIME ZONE 'Asia/Colombo')::date;
  -- Convert Sri Lanka midnight to UTC for timestamp comparisons
  _today_start := (_today::text || ' 00:00:00 Asia/Colombo')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  -- Check if already claimed today (Sri Lanka day)
  SELECT EXISTS(
    SELECT 1 FROM public.transactions
    WHERE user_id = _user_id
      AND type = 'commission'
      AND description LIKE 'Daily package income%'
      AND created_at >= _today_start
      AND created_at <  _today_end
  ) INTO _already_claimed;

  IF _already_claimed THEN
    RETURN jsonb_build_object('success', false, 'already_claimed', true, 'error', 'Already claimed today');
  END IF;

  -- Sum income from all active, non-expired packages (5% of price_paid per day)
  FOR _pkg IN
    SELECT id, price_paid FROM public.user_packages
    WHERE user_id = _user_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    _income := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
    _total_income := _total_income + _income;
    _pkg_count := _pkg_count + 1;
  END LOOP;

  IF _total_income <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active packages');
  END IF;

  SELECT balance INTO _bal_before FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  UPDATE public.wallets
  SET balance          = balance + _total_income,
      total_commission = total_commission + _total_income,
      updated_at       = now()
  WHERE user_id = _user_id;

  SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user_id;

  IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES (
      'integrity_error', 'critical',
      '⚠️ Balance Mismatch on Daily Package Income',
      'Package income credit mismatch for user. Before: Rs ' || _bal_before::text
        || ', Income: Rs ' || _total_income::text
        || ', Expected After: Rs ' || (_bal_before + _total_income)::text
        || ', Actual After: Rs ' || _bal_after::text,
      ARRAY[_user_id]
    );
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (
    _user_id, 'commission', _total_income, 'approved',
    'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
  );

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (
    _user_id, 'money', '💰 Daily Package Income Credited',
    'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
  );

  RETURN jsonb_build_object('success', true, 'amount', _total_income, 'packages', _pkg_count);
END;
$function$;

-- 3. Fix process_all_daily_incomes to use Sri Lanka timezone
CREATE OR REPLACE FUNCTION public.process_all_daily_incomes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date;
  _today_start timestamptz;
  _today_end   timestamptz;
  _user record;
  _pkg record;
  _income numeric;
  _total_income numeric;
  _pkg_count integer;
  _bal_before numeric;
  _bal_after numeric;
  _users_processed integer := 0;
  _total_credited numeric := 0;
BEGIN
  -- Use Sri Lanka timezone (Asia/Colombo = UTC+5:30)
  _today       := (now() AT TIME ZONE 'Asia/Colombo')::date;
  _today_start := (_today::text || ' 00:00:00 Asia/Colombo')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  FOR _user IN
    SELECT DISTINCT up.user_id
    FROM public.user_packages up
    WHERE up.is_active = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = _user.user_id
        AND type = 'commission'
        AND description LIKE 'Daily package income%'
        AND created_at >= _today_start
        AND created_at <  _today_end
    ) THEN
      CONTINUE;
    END IF;

    _total_income := 0;
    _pkg_count    := 0;

    FOR _pkg IN
      SELECT id, price_paid FROM public.user_packages
      WHERE user_id = _user.user_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    LOOP
      _income       := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
      _total_income := _total_income + _income;
      _pkg_count    := _pkg_count + 1;
    END LOOP;

    IF _total_income <= 0 THEN
      CONTINUE;
    END IF;

    SELECT balance INTO _bal_before
    FROM public.wallets WHERE user_id = _user.user_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.wallets
    SET balance          = balance + _total_income,
        total_commission = total_commission + _total_income,
        updated_at       = now()
    WHERE user_id = _user.user_id;

    SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user.user_id;

    IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES (
        'integrity_error', 'critical',
        '⚠️ Balance Mismatch – Midnight Income Credit',
        'Midnight cron: Before Rs ' || _bal_before::text
          || ', Income Rs ' || _total_income::text
          || ', Expected Rs ' || (_bal_before + _total_income)::text
          || ', Got Rs ' || _bal_after::text,
        ARRAY[_user.user_id]
      );
    END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (
      _user.user_id, 'commission', _total_income, 'approved',
      'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
    );

    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (
      _user.user_id, 'money', '💰 Daily Package Income Credited',
      'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
    );

    _users_processed := _users_processed + 1;
    _total_credited  := _total_credited + _total_income;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'users_processed', _users_processed,
    'total_credited', _total_credited,
    'run_at', now()
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220043257_8b5868f9-5f56-449a-930a-bc506f5a2b70.sql
-- ========================================== 


-- Change payment_method from enum to text for custom payment methods
ALTER TABLE public.deposit_requests ALTER COLUMN payment_method TYPE text USING payment_method::text;


-- ========================================== 
-- START MIGRATION: 20260220045019_b7ffe40a-381f-4b10-9f3c-67012de840cf.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.daily_checkin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _today date;
  _base_reward numeric := 10;
  _credit_score integer;
  _actual_reward numeric;
  _is_frozen boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := (now() AT TIME ZONE 'Asia/Colombo')::date;

  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  SELECT credit_score, is_frozen INTO _credit_score, _is_frozen FROM public.profiles WHERE user_id = _user_id;
  _credit_score := COALESCE(_credit_score, 100);

  IF COALESCE(_is_frozen, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  IF _credit_score < 100 THEN
    UPDATE public.profiles SET credit_score = LEAST(100, credit_score + 1) WHERE user_id = _user_id;
    _credit_score := LEAST(100, _credit_score + 1);
  END IF;

  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _actual_reward);

  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  -- Record transaction so it shows in Today's Overview and Earned History
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _actual_reward, 'approved',
    'Daily sign-in reward (Rs ' || _actual_reward::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward',
    'You received Rs ' || _actual_reward::text || ' for your daily check-in.' ||
    CASE WHEN _credit_score < 100 THEN ' Credit score recovered to ' || _credit_score || '%.' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'reward', _actual_reward, 'credit_score', _credit_score);
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220073202_db70d0b5-02e7-477f-87ab-de86802501c1.sql
-- ========================================== 


ALTER TABLE public.slider_banners ADD COLUMN link_url text DEFAULT NULL;
ALTER TABLE public.slider_banners ADD COLUMN offer_text text DEFAULT NULL;
ALTER TABLE public.slider_banners ADD COLUMN offer_expires_at timestamp with time zone DEFAULT NULL;


-- ========================================== 
-- START MIGRATION: 20260220090925_bc004b01-6a5d-47ca-bae9-ac72370aa971.sql
-- ========================================== 

ALTER TABLE public.slider_banners DROP COLUMN IF EXISTS offer_text;
ALTER TABLE public.slider_banners DROP COLUMN IF EXISTS offer_expires_at;

-- ========================================== 
-- START MIGRATION: 20260220101726_162d0c29-0538-4c4b-8884-177e6ee81d4a.sql
-- ========================================== 


-- 1. Update submit_withdrawal to use dynamic minimum based on credit score
CREATE OR REPLACE FUNCTION public.submit_withdrawal(p_amount numeric, p_bank_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _bal numeric;
  _new_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
  _credit_score integer;
  _fee_pct numeric;
  _fee numeric;
  _net numeric;
  _total_deposited numeric;
  _min_withdrawal numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_frozen, credit_score INTO _is_frozen, _credit_score FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  _credit_score := COALESCE(_credit_score, 100);

  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  SELECT total_deposited INTO _total_deposited FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_total_deposited, 0) < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must deposit at least Rs 500 before withdrawing');
  END IF;

  -- Dynamic minimum withdrawal based on credit score
  _min_withdrawal := 1000 + ((100 - _credit_score) * 50);

  IF p_amount < _min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs ' || _min_withdrawal::text || ' (credit score: ' || _credit_score || '%)');
  END IF;

  _fee_pct := 5.0 + ((100 - _credit_score) * 0.1);
  _fee := ROUND((p_amount * _fee_pct / 100)::numeric, 2);
  _net := p_amount;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _net THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets SET balance = balance - _net, updated_at = now() WHERE user_id = _user_id;
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id)
  VALUES (_user_id, p_amount, p_bank_account_id);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 
    'Withdrawal request (Fee: ' || _fee_pct || '% = Rs ' || _fee::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' is pending. Handling fee: ' || _fee_pct || '% (Rs ' || _fee::text || ').' ||
    CASE WHEN _credit_score < 100 THEN ' Fee increased due to ' || _credit_score || '% credit score.' ELSE '' END);

  IF abs(_new_bal - (_bal - _net)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Withdrawal',
      'Expected: Rs ' || (_bal - _net)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee_pct', _fee_pct, 'fee', _fee, 'credit_score', _credit_score);
END;
$function$;

-- 2. Update ban_user (with duration) to accept p_reason
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL::integer, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
  _ban_expires_at timestamptz;
  _reason_text text;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  _reason_text := CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ' Reason: ' || p_reason ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.' || _reason_text);

  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'ban_count', _new_ban_count, 
    'new_credit_score', _new_credit,
    'ban_expires_at', _ban_expires_at,
    'is_temporary', p_duration_hours IS NOT NULL
  );
END;
$function$;

-- Drop the old single-param ban_user overload
DROP FUNCTION IF EXISTS public.ban_user(uuid);

-- 3. Create get_recent_activity RPC for global marquee
CREATE OR REPLACE FUNCTION public.get_recent_activity()
 RETURNS TABLE(display_name text, amount numeric, type text, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(
      LEFT(COALESCE(p.display_name, 'user'), 3) || '***@gmail.com',
      'use***@gmail.com'
    ) AS display_name,
    t.amount,
    t.type::text,
    t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status = 'approved'
    AND t.type IN ('withdrawal', 'deposit', 'commission')
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220104025_f5c524fc-3fbc-4d64-ae4b-585695f52bd8.sql
-- ========================================== 


-- Drop old overloaded versions of ban_user and recreate with downward cascade
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
  _ban_expires_at timestamptz;
  _reason_text text;
  -- Downward cascade: team members under this banned user
  _sub record;
  _sub_profile record;
  _sub_penalty_pct numeric;
  _sub_penalty integer;
  _sub_new_credit integer;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  _reason_text := CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ' Reason: ' || p_reason ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.' || _reason_text);

  -- UPWARD cascade: penalize referrers (people who referred the banned user)
  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned.');
    END IF;
  END LOOP;

  -- DOWNWARD cascade: penalize team members (people the banned user referred)
  FOR _sub IN 
    SELECT referred_id, tier FROM public.referrals WHERE referrer_id = p_user_id
  LOOP
    _sub_penalty_pct := _new_ban_count * (CASE _sub.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _sub_profile FROM public.profiles WHERE user_id = _sub.referred_id;
    IF FOUND AND _sub_penalty_pct > 0 THEN
      _sub_penalty := LEAST(CEIL(_sub_profile.credit_score * _sub_penalty_pct / 100), _sub_profile.credit_score);
      _sub_new_credit := GREATEST(0, _sub_profile.credit_score - _sub_penalty);

      UPDATE public.profiles SET credit_score = _sub_new_credit WHERE user_id = _sub.referred_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_sub.referred_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _sub_penalty || '% (now ' || _sub_new_credit || '%) because your team leader (' || COALESCE(_user.display_name, 'Unknown') || ') was banned. Reason: ' || COALESCE(p_reason, 'Not specified'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'ban_count', _new_ban_count, 
    'new_credit_score', _new_credit,
    'ban_expires_at', _ban_expires_at,
    'is_temporary', p_duration_hours IS NOT NULL
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220105158_db11402a-61b4-43d3-a473-f4c9dc547ba7.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
  _ban_expires_at timestamptz;
  _reason_text text;
  _sub record;
  _sub_profile record;
  _sub_penalty_pct numeric;
  _sub_penalty integer;
  _sub_new_credit integer;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  -- Self penalty: 20% per ban (escalating)
  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  _reason_text := CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ' Reason: ' || p_reason ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.' || _reason_text);

  -- UPWARD cascade: penalize referrers (reduced rates: Tier1=1%, Tier2=0.5%, Tier3=0.25%)
  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 1.0 WHEN 2 THEN 0.5 WHEN 3 THEN 0.25 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned.');
    END IF;
  END LOOP;

  -- DOWNWARD cascade: penalize team members (reduced rates: Tier1=1%, Tier2=0.5%, Tier3=0.25%)
  FOR _sub IN 
    SELECT referred_id, tier FROM public.referrals WHERE referrer_id = p_user_id
  LOOP
    _sub_penalty_pct := _new_ban_count * (CASE _sub.tier WHEN 1 THEN 1.0 WHEN 2 THEN 0.5 WHEN 3 THEN 0.25 ELSE 0 END);
    
    SELECT * INTO _sub_profile FROM public.profiles WHERE user_id = _sub.referred_id;
    IF FOUND AND _sub_penalty_pct > 0 THEN
      _sub_penalty := LEAST(CEIL(_sub_profile.credit_score * _sub_penalty_pct / 100), _sub_profile.credit_score);
      _sub_new_credit := GREATEST(0, _sub_profile.credit_score - _sub_penalty);

      UPDATE public.profiles SET credit_score = _sub_new_credit WHERE user_id = _sub.referred_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_sub.referred_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _sub_penalty || '% (now ' || _sub_new_credit || '%) because your team leader (' || COALESCE(_user.display_name, 'Unknown') || ') was banned. Reason: ' || COALESCE(p_reason, 'Not specified'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'ban_count', _new_ban_count, 
    'new_credit_score', _new_credit,
    'ban_expires_at', _ban_expires_at,
    'is_temporary', p_duration_hours IS NOT NULL
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220111712_b8de3e2f-e6d3-4ec5-afa7-f69996f272af.sql
-- ========================================== 

CREATE POLICY "Admins can delete device logs"
ON public.device_logs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================== 
-- START MIGRATION: 20260220120728_eb961233-474a-4f08-b82a-01dedd3f0cbd.sql
-- ========================================== 


-- Drop and recreate with description column
DROP FUNCTION IF EXISTS public.get_recent_activity();

CREATE OR REPLACE FUNCTION public.get_recent_activity()
 RETURNS TABLE(display_name text, amount numeric, type text, created_at timestamp with time zone, description text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(
      LEFT(COALESCE(p.display_name, 'user'), 3) || '***@gmail.com',
      'use***@gmail.com'
    ) AS display_name,
    t.amount,
    t.type::text,
    t.created_at,
    t.description
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status = 'approved'
    AND t.type IN ('withdrawal', 'deposit', 'commission', 'refund')
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260220121643_b534f1bb-0bb7-4205-9662-5445951006db.sql
-- ========================================== 


CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _code_data record;
  _existing record;
  _credit_score integer;
  _base_reward numeric;
  _actual_reward numeric;
  _bal_before numeric;
  _bal_after numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user is frozen
  SELECT credit_score, is_frozen INTO _credit_score
  FROM public.profiles WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  _credit_score := COALESCE(_credit_score, 100);

  -- Find the code
  SELECT * INTO _code_data FROM public.redeem_codes
  WHERE code = UPPER(TRIM(p_code)) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check expiry
  IF _code_data.expires_at IS NOT NULL AND _code_data.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has expired');
  END IF;

  -- Check max uses
  IF _code_data.current_uses >= _code_data.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has reached its usage limit');
  END IF;

  -- Check if user already used this code
  SELECT id INTO _existing FROM public.redeem_code_uses
  WHERE code_id = _code_data.id AND user_id = _user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  -- Scale reward by credit score
  _base_reward := _code_data.reward_amount;
  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  -- Get balance before
  SELECT balance INTO _bal_before FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Credit wallet
  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  -- Verify balance
  SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user_id;

  IF abs(_bal_after - (_bal_before + _actual_reward)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Redeem Code',
      'User redeemed code ' || _code_data.code || '. Before: Rs ' || _bal_before::text || ', Reward: Rs ' || _actual_reward::text || ', Expected: Rs ' || (_bal_before + _actual_reward)::text || ', Actual: Rs ' || _bal_after::text,
      ARRAY[_user_id]);
  END IF;

  -- Record usage
  INSERT INTO public.redeem_code_uses (code_id, user_id) VALUES (_code_data.id, _user_id);
  UPDATE public.redeem_codes SET current_uses = current_uses + 1 WHERE id = _code_data.id;

  -- Create transaction (refund type for Today's Earnings)
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'refund', _actual_reward, 'approved',
    'Redeemed promo code: ' || _code_data.code ||
    CASE WHEN _credit_score < 100 THEN ' (scaled by ' || _credit_score || '% credit)' ELSE '' END);

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'promo', 'Promo Code Redeemed!',
    'You received Rs ' || _actual_reward::text || ' from promo code ' || _code_data.code || '.' ||
    CASE WHEN _credit_score < 100 THEN ' (Reduced from Rs ' || _base_reward::text || ' due to ' || _credit_score || '% credit score)' ELSE '' END);

  RETURN jsonb_build_object(
    'success', true,
    'reward', _actual_reward,
    'base_reward', _base_reward,
    'credit_score', _credit_score,
    'code', _code_data.code
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260221021105_e4b42809-63c8-4788-a3ea-fdce32a239ee.sql
-- ========================================== 

-- Function to auto-deactivate expired packages
CREATE OR REPLACE FUNCTION public.deactivate_expired_packages()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _deactivated integer := 0;
BEGIN
  UPDATE public.user_packages
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  
  GET DIAGNOSTICS _deactivated = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deactivated_count', _deactivated,
    'run_at', now()
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260221021134_b6942ae8-3f55-4634-887c-dc8c7b1ca0ef.sql
-- ========================================== 

-- Update process_all_daily_incomes to also deactivate expired packages at the start
CREATE OR REPLACE FUNCTION public.process_all_daily_incomes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date;
  _today_start timestamptz;
  _today_end   timestamptz;
  _user record;
  _pkg record;
  _income numeric;
  _total_income numeric;
  _pkg_count integer;
  _bal_before numeric;
  _bal_after numeric;
  _users_processed integer := 0;
  _total_credited numeric := 0;
  _deactivated integer := 0;
BEGIN
  -- Auto-deactivate expired packages first
  UPDATE public.user_packages
  SET is_active = false
  WHERE is_active = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS _deactivated = ROW_COUNT;

  -- Use Sri Lanka timezone (Asia/Colombo = UTC+5:30)
  _today       := (now() AT TIME ZONE 'Asia/Colombo')::date;
  _today_start := (_today::text || ' 00:00:00 Asia/Colombo')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  FOR _user IN
    SELECT DISTINCT up.user_id
    FROM public.user_packages up
    WHERE up.is_active = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = _user.user_id
        AND type = 'commission'
        AND description LIKE 'Daily package income%'
        AND created_at >= _today_start
        AND created_at <  _today_end
    ) THEN
      CONTINUE;
    END IF;

    _total_income := 0;
    _pkg_count    := 0;

    FOR _pkg IN
      SELECT id, price_paid FROM public.user_packages
      WHERE user_id = _user.user_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    LOOP
      _income       := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
      _total_income := _total_income + _income;
      _pkg_count    := _pkg_count + 1;
    END LOOP;

    IF _total_income <= 0 THEN
      CONTINUE;
    END IF;

    SELECT balance INTO _bal_before
    FROM public.wallets WHERE user_id = _user.user_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.wallets
    SET balance          = balance + _total_income,
        total_commission = total_commission + _total_income,
        updated_at       = now()
    WHERE user_id = _user.user_id;

    SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user.user_id;

    IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES (
        'integrity_error', 'critical',
        '⚠️ Balance Mismatch – Midnight Income Credit',
        'Midnight cron: Before Rs ' || _bal_before::text
          || ', Income Rs ' || _total_income::text
          || ', Expected Rs ' || (_bal_before + _total_income)::text
          || ', Got Rs ' || _bal_after::text,
        ARRAY[_user.user_id]
      );
    END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (
      _user.user_id, 'commission', _total_income, 'approved',
      'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
    );

    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (
      _user.user_id, 'money', '💰 Daily Package Income Credited',
      'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
    );

    _users_processed := _users_processed + 1;
    _total_credited  := _total_credited + _total_income;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'users_processed', _users_processed,
    'total_credited', _total_credited,
    'packages_deactivated', _deactivated,
    'run_at', now()
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260221021957_397811ad-6247-42b4-87d4-451b63a7a632.sql
-- ========================================== 


-- Update deactivate_expired_packages to notify users and DELETE expired packages
CREATE OR REPLACE FUNCTION public.deactivate_expired_packages()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _expired record;
  _deleted integer := 0;
  _pkg_name text;
BEGIN
  FOR _expired IN
    SELECT up.id, up.user_id, up.package_id, up.price_paid, up.expires_at,
           ap.name as package_name
    FROM public.user_packages up
    LEFT JOIN public.ai_packages ap ON ap.id = up.package_id
    WHERE up.is_active = true
      AND up.expires_at IS NOT NULL
      AND up.expires_at <= now()
  LOOP
    _pkg_name := COALESCE(_expired.package_name, 'Package');
    
    -- Notify user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_expired.user_id, 'system', '📦 Package Expired',
      'Your ' || _pkg_name || ' (Rs ' || _expired.price_paid::text || ') has expired and been removed. You can purchase it again anytime.');

    -- Delete the expired package
    DELETE FROM public.user_packages WHERE id = _expired.id;
    
    _deleted := _deleted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', _deleted,
    'run_at', now()
  );
END;
$function$;

-- Update process_all_daily_incomes to use the new delete logic
CREATE OR REPLACE FUNCTION public.process_all_daily_incomes()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _today date;
  _today_start timestamptz;
  _today_end   timestamptz;
  _user record;
  _pkg record;
  _income numeric;
  _total_income numeric;
  _pkg_count integer;
  _bal_before numeric;
  _bal_after numeric;
  _users_processed integer := 0;
  _total_credited numeric := 0;
  _deactivate_result jsonb;
BEGIN
  -- Auto-delete expired packages first (with notifications)
  _deactivate_result := public.deactivate_expired_packages();

  -- Also process expired bans
  PERFORM public.process_expired_bans();

  -- Use Sri Lanka timezone (Asia/Colombo = UTC+5:30)
  _today       := (now() AT TIME ZONE 'Asia/Colombo')::date;
  _today_start := (_today::text || ' 00:00:00 Asia/Colombo')::timestamptz;
  _today_end   := _today_start + interval '1 day';

  FOR _user IN
    SELECT DISTINCT up.user_id
    FROM public.user_packages up
    WHERE up.is_active = true
      AND (up.expires_at IS NULL OR up.expires_at > now())
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = _user.user_id
        AND type = 'commission'
        AND description LIKE 'Daily package income%'
        AND created_at >= _today_start
        AND created_at <  _today_end
    ) THEN
      CONTINUE;
    END IF;

    _total_income := 0;
    _pkg_count    := 0;

    FOR _pkg IN
      SELECT id, price_paid FROM public.user_packages
      WHERE user_id = _user.user_id
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
    LOOP
      _income       := ROUND((_pkg.price_paid * 0.05)::numeric, 2);
      _total_income := _total_income + _income;
      _pkg_count    := _pkg_count + 1;
    END LOOP;

    IF _total_income <= 0 THEN
      CONTINUE;
    END IF;

    SELECT balance INTO _bal_before
    FROM public.wallets WHERE user_id = _user.user_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.wallets
    SET balance          = balance + _total_income,
        total_commission = total_commission + _total_income,
        updated_at       = now()
    WHERE user_id = _user.user_id;

    SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user.user_id;

    IF abs(_bal_after - (_bal_before + _total_income)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES (
        'integrity_error', 'critical',
        '⚠️ Balance Mismatch – Midnight Income Credit',
        'Midnight cron: Before Rs ' || _bal_before::text
          || ', Income Rs ' || _total_income::text
          || ', Expected Rs ' || (_bal_before + _total_income)::text
          || ', Got Rs ' || _bal_after::text,
        ARRAY[_user.user_id]
      );
    END IF;

    INSERT INTO public.transactions (user_id, type, amount, status, description)
    VALUES (
      _user.user_id, 'commission', _total_income, 'approved',
      'Daily package income (Rs ' || _total_income::text || ' from ' || _pkg_count::text || ' package(s))'
    );

    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (
      _user.user_id, 'money', '💰 Daily Package Income Credited',
      'Rs ' || _total_income::text || ' has been credited to your wallet from ' || _pkg_count::text || ' active AI package(s).'
    );

    _users_processed := _users_processed + 1;
    _total_credited  := _total_credited + _total_income;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'users_processed', _users_processed,
    'total_credited', _total_credited,
    'packages_deleted', COALESCE((_deactivate_result->>'deleted_count')::integer, 0),
    'run_at', now()
  );
END;
$function$;


-- ========================================== 
-- START MIGRATION: 20260531234500_remove_deposit_bank.sql
-- ========================================== 

-- Remove default deposit bank details from platform settings
DELETE FROM public.platform_settings WHERE key = 'deposit_bank';


-- ========================================== 
-- START MIGRATION: 20260531235900_nowpayments_settings.sql
-- ========================================== 

-- Update RLS policies for platform_settings to secure sensitive config key
DROP POLICY IF EXISTS "Anyone can read platform settings" ON public.platform_settings;

-- Allow public read only for non-sensitive keys
CREATE POLICY "Anyone can read public platform settings"
ON public.platform_settings
FOR SELECT
USING (
  key != 'nowpayments_settings'
);

-- Seed default settings for NOWPayments (disabled by default)
INSERT INTO public.platform_settings (key, value)
VALUES (
  'nowpayments_settings',
  '{"enabled": false}'::jsonb
)
ON CONFLICT (key) DO NOTHING;


-- ========================================== 
-- START MIGRATION: 20260601005200_nowpayments_webhook.sql
-- ========================================== 

-- Database function to process NOWPayments IPN status updates
CREATE OR REPLACE FUNCTION public.process_nowpayments_deposit(
  p_deposit_id uuid,
  p_payment_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dep record;
  _bal numeric;
  _new_bal numeric;
  _display_name text;
  _new_status request_status;
  _note_text text;
BEGIN
  -- Get deposit record
  SELECT * INTO _dep FROM public.deposit_requests WHERE id = p_deposit_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Deposit request not found'); 
  END IF;
  
  IF _dep.status != 'pending' THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already processed'); 
  END IF;

  _note_text := 'Cryptocurrency IPN notification received. Payment status: ' || p_payment_status;

  -- Map NOWPayments status to our internal request_status ('pending', 'approved', 'rejected')
  IF p_payment_status = 'finished' OR p_payment_status = 'confirmed' THEN
    _new_status := 'approved';
  ELSIF p_payment_status = 'failed' OR p_payment_status = 'expired' OR p_payment_status = 'refunded' THEN
    _new_status := 'rejected';
  ELSE
    -- For any other statuses (like 'waiting', 'confirming', 'sending'), update notes but keep status pending
    UPDATE public.deposit_requests 
    SET notes = COALESCE(notes, '') || E'\n' || _note_text, updated_at = now() 
    WHERE id = p_deposit_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Status updated (still pending)');
  END IF;

  IF _new_status = 'approved' THEN
    -- Lock wallet and get balance
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _dep.user_id FOR UPDATE;
    IF NOT FOUND THEN 
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found'); 
    END IF;

    -- Update deposit status
    UPDATE public.deposit_requests 
    SET status = 'approved', 
        notes = COALESCE(notes, '') || E'\n' || _note_text, 
        updated_at = now() 
    WHERE id = p_deposit_id;

    -- Credit user wallet
    UPDATE public.wallets 
    SET balance = balance + _dep.amount, 
        total_deposited = total_deposited + _dep.amount, 
        updated_at = now() 
    WHERE user_id = _dep.user_id;

    -- Verify balance integrity
    SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _dep.user_id;

    -- Update/insert transaction record
    UPDATE public.transactions 
    SET status = 'approved', 
        description = 'Crypto Deposit completed via Cryptocurrency'
    WHERE user_id = _dep.user_id 
      AND type = 'deposit' 
      AND status = 'pending' 
      AND reference_id = p_deposit_id;

    IF NOT FOUND THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
      VALUES (_dep.user_id, 'deposit', _dep.amount, 'approved', 'Crypto Deposit completed via Cryptocurrency', p_deposit_id);
    END IF;

    -- Send notification to user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_dep.user_id, 'money', 'Deposit Approved ✅',
      'Your crypto deposit of Rs ' || _dep.amount::text || ' has been automatically processed and credited to your wallet.');

    -- Integrity check alert
    IF abs(_new_bal - (_bal + _dep.amount)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Crypto Deposit',
        'Expected: Rs ' || (_bal + _dep.amount)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_dep.user_id]);
    END IF;

    -- Distribute referral commissions
    DECLARE
      _rates jsonb;
      _ref record;
      _rate numeric;
      _comm_amount numeric;
      _earner_credit integer;
    BEGIN
      SELECT value INTO _rates FROM public.platform_settings WHERE key = 'commission_rates';
      IF _rates IS NOT NULL THEN
        FOR _ref IN SELECT referrer_id, tier FROM public.referrals WHERE referred_id = _dep.user_id LOOP
          _rate := CASE _ref.tier
            WHEN 1 THEN COALESCE((_rates->>'level_1')::numeric, 0)
            WHEN 2 THEN COALESCE((_rates->>'level_2')::numeric, 0)
            WHEN 3 THEN COALESCE((_rates->>'level_3')::numeric, 0)
            ELSE 0
          END;
          IF _rate <= 0 THEN CONTINUE; END IF;

          -- Scale commission by earner's credit score
          SELECT credit_score INTO _earner_credit FROM public.profiles WHERE user_id = _ref.referrer_id;
          _earner_credit := COALESCE(_earner_credit, 100);
          
          _comm_amount := ROUND((_dep.amount * _rate / 100 * _earner_credit / 100)::numeric, 2);
          IF _comm_amount < 0.01 THEN CONTINUE; END IF;

          INSERT INTO public.commissions (user_id, amount, tier, from_user_id, source_type, source_id)
          VALUES (_ref.referrer_id, _comm_amount, _ref.tier, _dep.user_id, 'deposit', p_deposit_id);

          UPDATE public.wallets 
          SET balance = balance + _comm_amount, 
              total_commission = total_commission + _comm_amount, 
              updated_at = now()
          WHERE user_id = _ref.referrer_id;

          INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
          VALUES (_ref.referrer_id, 'commission', _comm_amount, 'approved', 
            'Tier ' || _ref.tier || ' commission' || CASE WHEN _earner_credit < 100 THEN ' (Credit: ' || _earner_credit || '%)' ELSE '' END, p_deposit_id);

          INSERT INTO public.notifications (user_id, type, title, description)
          VALUES (_ref.referrer_id, 'money', 'Commission Earned 🎉',
            'You earned Rs ' || _comm_amount::text || ' (Tier ' || _ref.tier || ') from a team member''s deposit.');
        END LOOP;
      END IF;
    END;

    RETURN jsonb_build_object('success', true, 'status', 'approved');

  ELSIF _new_status = 'rejected' THEN
    -- Update deposit status to rejected
    UPDATE public.deposit_requests 
    SET status = 'rejected', 
        notes = COALESCE(notes, '') || E'\n' || _note_text, 
        updated_at = now() 
    WHERE id = p_deposit_id;

    -- Update transactions status to rejected
    UPDATE public.transactions 
    SET status = 'rejected', 
        description = 'Crypto Deposit failed: ' || p_payment_status
    WHERE user_id = _dep.user_id 
      AND type = 'deposit' 
      AND status = 'pending' 
      AND reference_id = p_deposit_id;

    -- Send notification to user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_dep.user_id, 'system', 'Deposit Failed ❌',
      'Your crypto deposit of Rs ' || _dep.amount::text || ' has failed. Status: ' || p_payment_status);

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unexpected execution path');
END;
$$;

-- Secure the function so it can't be called by standard anonymous or authenticated users via REST API
REVOKE EXECUTE ON FUNCTION public.process_nowpayments_deposit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_nowpayments_deposit(uuid, text) TO postgres, service_role;


-- ========================================== 
-- START MIGRATION: 20260601015600_add_cancelled_status.sql
-- ========================================== 

-- Add 'cancelled' to request_status enum type to support user cancellation of pending checkouts
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Enable Realtime replication for the deposit_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.deposit_requests;


-- ========================================== 
-- START MIGRATION: 20260601093500_add_completed_status.sql
-- ========================================== 

-- Add 'completed' to request_status enum type to support manual withdrawal completion
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'completed';


-- ========================================== 
-- START MIGRATION: 20260601093600_manual_withdrawal.sql
-- ========================================== 

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


-- ========================================== 
-- START MIGRATION: 20260601104000_cascade_delete_package.sql
-- ========================================== 

-- Alter user_packages foreign key to support cascade deletion of packages
ALTER TABLE public.user_packages
DROP CONSTRAINT IF EXISTS user_packages_package_id_fkey,
ADD CONSTRAINT user_packages_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.ai_packages(id)
  ON DELETE CASCADE;


-- ========================================== 
-- START MIGRATION: 20260602230000_platform_settings_read_policy.sql
-- ========================================== 

-- Drop the existing SELECT policy that was restricting nowpayments_settings from regular users
DROP POLICY IF EXISTS "Anyone can read public platform settings" ON public.platform_settings;

-- Create a new SELECT policy allowing all authenticated users to read the platform settings
CREATE POLICY "Anyone can read public platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);


-- ========================================== 
-- START MIGRATION: 20260603004500_deposit_cancel_policies.sql
-- ========================================== 

-- Allow users to update their own pending deposits to cancelled
DROP POLICY IF EXISTS "Users can cancel own deposits" ON public.deposit_requests;
CREATE POLICY "Users can cancel own deposits"
ON public.deposit_requests
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- Allow users to update their own pending transactions to rejected
DROP POLICY IF EXISTS "Users can cancel own transactions" ON public.transactions;
CREATE POLICY "Users can cancel own transactions"
ON public.transactions
FOR UPDATE
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'rejected');





