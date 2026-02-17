
-- Update purchase_package to include integrity checks
CREATE OR REPLACE FUNCTION public.purchase_package(p_package_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _pkg record;
  _price numeric;
  _bal numeric;
  _new_bal numeric;
  _expires_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _pkg FROM public.ai_packages WHERE id = p_package_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found or inactive');
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

  UPDATE public.wallets SET balance = balance - _price, updated_at = now() WHERE user_id = _user_id;

  -- Verify balance after deduction
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.user_packages (user_id, package_id, price_paid, expires_at)
  VALUES (_user_id, p_package_id, _price, _expires_at);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'purchase', _price, 'approved', 'Purchased ' || _pkg.name);

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Package Purchased',
    'You successfully purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Daily income will be added automatically.');

  -- Integrity check: verify balance math
  IF abs(_new_bal - (_bal - _price)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Purchase',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Expected balance: Rs ' || (_bal - _price)::text || ', Actual: Rs ' || _new_bal::text || '. Possible concurrent transaction.',
      ARRAY[_user_id]);
  ELSE
    -- Normal purchase alert
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('package_purchase', 'info', 'Package Purchased ✅',
      'User purchased ' || _pkg.name || ' for Rs ' || _price::text || '. Balance: Rs ' || _bal::text || ' → Rs ' || _new_bal::text || '. Verified OK.',
      ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'price', _price, 'package_name', _pkg.name);
END;
$$;
