
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
