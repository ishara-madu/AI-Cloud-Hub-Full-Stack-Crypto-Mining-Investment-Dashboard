
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
