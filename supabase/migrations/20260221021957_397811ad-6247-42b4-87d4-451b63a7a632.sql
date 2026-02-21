
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
