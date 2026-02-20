
CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _code_data record;
  _existing record;
  _credit_score integer;
  _base_reward numeric;
  _actual_reward numeric;
  _bal_before numeric;
  _bal_after numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user is frozen
  SELECT credit_score, is_frozen INTO _credit_score
  FROM public.profiles WHERE user_id = _user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  _credit_score := COALESCE(_credit_score, 100);

  -- Find the code
  SELECT * INTO _code_data FROM public.redeem_codes
  WHERE code = UPPER(TRIM(p_code)) AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check expiry
  IF _code_data.expires_at IS NOT NULL AND _code_data.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has expired');
  END IF;

  -- Check max uses
  IF _code_data.current_uses >= _code_data.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'This promo code has reached its usage limit');
  END IF;

  -- Check if user already used this code
  SELECT id INTO _existing FROM public.redeem_code_uses
  WHERE code_id = _code_data.id AND user_id = _user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already used this promo code');
  END IF;

  -- Scale reward by credit score
  _base_reward := _code_data.reward_amount;
  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  -- Get balance before
  SELECT balance INTO _bal_before FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Credit wallet
  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  -- Verify balance
  SELECT balance INTO _bal_after FROM public.wallets WHERE user_id = _user_id;

  IF abs(_bal_after - (_bal_before + _actual_reward)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Redeem Code',
      'User redeemed code ' || _code_data.code || '. Before: Rs ' || _bal_before::text || ', Reward: Rs ' || _actual_reward::text || ', Expected: Rs ' || (_bal_before + _actual_reward)::text || ', Actual: Rs ' || _bal_after::text,
      ARRAY[_user_id]);
  END IF;

  -- Record usage
  INSERT INTO public.redeem_code_uses (code_id, user_id) VALUES (_code_data.id, _user_id);
  UPDATE public.redeem_codes SET current_uses = current_uses + 1 WHERE id = _code_data.id;

  -- Create transaction (refund type for Today's Earnings)
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'refund', _actual_reward, 'approved',
    'Redeemed promo code: ' || _code_data.code ||
    CASE WHEN _credit_score < 100 THEN ' (scaled by ' || _credit_score || '% credit)' ELSE '' END);

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'promo', 'Promo Code Redeemed!',
    'You received Rs ' || _actual_reward::text || ' from promo code ' || _code_data.code || '.' ||
    CASE WHEN _credit_score < 100 THEN ' (Reduced from Rs ' || _base_reward::text || ' due to ' || _credit_score || '% credit score)' ELSE '' END);

  RETURN jsonb_build_object(
    'success', true,
    'reward', _actual_reward,
    'base_reward', _base_reward,
    'credit_score', _credit_score,
    'code', _code_data.code
  );
END;
$function$;
