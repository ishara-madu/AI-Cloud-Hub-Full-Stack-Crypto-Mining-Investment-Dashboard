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
