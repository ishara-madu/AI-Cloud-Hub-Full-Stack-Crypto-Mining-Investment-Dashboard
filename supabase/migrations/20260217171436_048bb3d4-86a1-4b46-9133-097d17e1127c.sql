-- Allow admins to insert commissions (for deposit commission distribution)
CREATE POLICY "Admins can insert commissions"
ON public.commissions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
