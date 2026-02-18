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