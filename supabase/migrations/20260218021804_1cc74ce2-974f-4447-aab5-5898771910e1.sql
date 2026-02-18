
-- Update purchase_package to:
-- 1. Prevent buying the same package if user already has an active one
-- 2. Credit first day's income (5% of price_paid) immediately upon purchase

CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
  _daily_income numeric;
  _already_owns boolean;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
  END IF;

  -- ✅ Prevent duplicate active package purchase
  SELECT EXISTS(
    SELECT 1 FROM public.user_packages
    WHERE user_id = _user_id
      AND package_id = p_package_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  ) INTO _already_owns;

  IF _already_owns THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already own this active package');
  END IF;

  _price := COALESCE(_pkg.price_onetime, _pkg.price_monthly, 0);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF _pkg.duration_days IS NOT NULL THEN
    _expires_at := now() + (_pkg.duration_days || ' days')::interval;
  END IF;

  -- Deduct purchase price
  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Insert user package record
  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  -- Log purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  -- ✅ Credit first day's income immediately (5% of price_paid)
  _daily_income := ROUND((_price * 0.05)::numeric, 2);

  UPDATE public.wallets
  SET balance          = balance + _daily_income,
      total_commission = total_commission + _daily_income,
      updated_at       = now()
  WHERE user_id = _user_id;

  -- Log daily income transaction (avoids double-claim since it's a specific package purchase event)
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _daily_income, 'approved',
    'Daily package income (Rs ' || _daily_income::text || ' from 1 package(s))');

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased + Income Credited 💰',
    'You purchased ' || _pkg.name || ' for Rs ' || _price::text || '. First day income of Rs ' || _daily_income::text || ' credited immediately!');

  -- Integrity check after all operations
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;
  IF abs(_new_bal - (_bal - _price + _daily_income)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || ' + income Rs ' || _daily_income::text ||
      '. Expected: Rs ' || (_bal - _price + _daily_income)::text || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name, 'daily_income', _daily_income);
END;
$function$;
