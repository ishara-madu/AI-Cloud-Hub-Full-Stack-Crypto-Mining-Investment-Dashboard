
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
