
-- 1. Update daily_checkin to recover credit score (+1 per day if not frozen, max 100)
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

  _today := CURRENT_DATE;

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

-- 2. Update submit_withdrawal to require minimum Rs 500 total deposits
CREATE OR REPLACE FUNCTION public.submit_withdrawal(p_amount numeric, p_bank_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _bal numeric;
  _new_bal numeric;
  _is_frozen boolean;
  _has_pkg boolean;
  _credit_score integer;
  _fee_pct numeric;
  _fee numeric;
  _net numeric;
  _total_deposited numeric;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT is_frozen, credit_score INTO _is_frozen, _credit_score FROM public.profiles WHERE user_id = _user_id;
  IF _is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;
  _credit_score := COALESCE(_credit_score, 100);

  SELECT EXISTS(SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND is_active = true) INTO _has_pkg;
  IF NOT _has_pkg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active package required');
  END IF;

  -- Check minimum deposit requirement
  SELECT total_deposited INTO _total_deposited FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_total_deposited, 0) < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must deposit at least Rs 500 before withdrawing');
  END IF;

  IF p_amount < 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs 1,000');
  END IF;

  _fee_pct := 5.0 + ((100 - _credit_score) * 0.1);
  _fee := ROUND((p_amount * _fee_pct / 100)::numeric, 2);
  _net := p_amount;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF _bal < _net THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.wallets SET balance = balance - _net, updated_at = now() WHERE user_id = _user_id;
  SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount, bank_account_id)
  VALUES (_user_id, p_amount, p_bank_account_id);

  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'withdrawal', p_amount, 'pending', 
    'Withdrawal request (Fee: ' || _fee_pct || '% = Rs ' || _fee::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Withdrawal Request Submitted',
    'Your withdrawal of Rs ' || p_amount::text || ' is pending. Handling fee: ' || _fee_pct || '% (Rs ' || _fee::text || ').' ||
    CASE WHEN _credit_score < 100 THEN ' Fee increased due to ' || _credit_score || '% credit score.' ELSE '' END);

  IF abs(_new_bal - (_bal - _net)) > 0.01 THEN
    INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
    VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Withdrawal',
      'Expected: Rs ' || (_bal - _net)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_user_id]);
  END IF;

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'fee_pct', _fee_pct, 'fee', _fee, 'credit_score', _credit_score);
END;
$function$;
