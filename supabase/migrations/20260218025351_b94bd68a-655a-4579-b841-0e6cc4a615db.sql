-- Fix purchase_package to actually credit cashback to user balance
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
  _cashback_amt numeric;
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

  -- Prevent duplicate active package purchase
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

  -- Credit first day's income immediately (5% of price_paid)
  _daily_income := ROUND((_price * 0.05)::numeric, 2);
  UPDATE public.wallets
  SET balance = balance + _daily_income,
      total_commission = total_commission + _daily_income,
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _daily_income, 'approved',
    'Daily package income (Rs ' || _daily_income::text || ' from 1 package(s))');

  -- Credit cashback if applicable
  _cashback_amt := 0;
  IF COALESCE(_pkg.cashback_percent, 0) > 0 THEN
    _cashback_amt := ROUND((_price * _pkg.cashback_percent / 100)::numeric, 2);
    IF _cashback_amt > 0 THEN
      UPDATE public.wallets
      SET balance = balance + _cashback_amt,
          total_commission = total_commission + _cashback_amt,
          updated_at = now()
      WHERE user_id = _user_id;

      INSERT INTO public.transactions (user_id, type, amount, status, description)
      VALUES (_user_id, 'refund', _cashback_amt, 'approved',
        'Cashback ' || _pkg.cashback_percent::text || '% on ' || _pkg.name || ' (Rs ' || _cashback_amt::text || ')');

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_user_id, 'money', '🎁 Cashback Credited!',
        'Rs ' || _cashback_amt::text || ' cashback (' || _pkg.cashback_percent::text || '%) credited for purchasing ' || _pkg.name || '!');
    END IF;
  END IF;

  -- Notify user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased + Income Credited 💰',
    'You purchased ' || _pkg.name || ' for Rs ' || _price::text || '. First day income Rs ' || _daily_income::text ||
    CASE WHEN _cashback_amt > 0 THEN ' + Cashback Rs ' || _cashback_amt::text ELSE '' END || ' credited immediately!');

  -- Integrity check
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;
  IF abs(_new_bal - (_bal - _price + _daily_income + _cashback_amt)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text
        || ' + income Rs ' || _daily_income::text
        || ' + cashback Rs ' || _cashback_amt::text
        || '. Expected: Rs ' || (_bal - _price + _daily_income + _cashback_amt)::text
        || ', Actual: Rs ' || _new_bal::text,
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'price', _price,
    'package_name', _pkg.name,
    'daily_income', _daily_income,
    'cashback', _cashback_amt
  );
END;
$function$;