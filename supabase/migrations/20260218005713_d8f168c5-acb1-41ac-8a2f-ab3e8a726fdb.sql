
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
