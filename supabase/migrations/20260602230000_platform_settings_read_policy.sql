-- Drop the existing SELECT policy that was restricting nowpayments_settings from regular users
DROP POLICY IF EXISTS "Anyone can read public platform settings" ON public.platform_settings;

-- Create a new SELECT policy allowing all authenticated users to read the platform settings
CREATE POLICY "Anyone can read public platform settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);
