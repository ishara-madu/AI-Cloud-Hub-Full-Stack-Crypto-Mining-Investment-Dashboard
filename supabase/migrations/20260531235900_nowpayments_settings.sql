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
