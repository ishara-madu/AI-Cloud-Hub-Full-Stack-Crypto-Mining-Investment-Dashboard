
-- 1. Update submit_withdrawal to use dynamic minimum based on credit score
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
  _min_withdrawal numeric;
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

  SELECT total_deposited INTO _total_deposited FROM public.wallets WHERE user_id = _user_id;
  IF COALESCE(_total_deposited, 0) < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must deposit at least Rs 500 before withdrawing');
  END IF;

  -- Dynamic minimum withdrawal based on credit score
  _min_withdrawal := 1000 + ((100 - _credit_score) * 50);

  IF p_amount < _min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is Rs ' || _min_withdrawal::text || ' (credit score: ' || _credit_score || '%)');
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

-- 2. Update ban_user (with duration) to accept p_reason
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL::integer, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
  _user record;
  _new_ban_count integer;
  _self_penalty integer;
  _new_credit integer;
  _team_penalty_pct numeric;
  _team_penalty integer;
  _ref record;
  _member record;
  _member_new_credit integer;
  _ban_expires_at timestamptz;
  _reason_text text;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  SELECT * INTO _user FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF _user.is_frozen THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already banned');
  END IF;

  _new_ban_count := _user.ban_count + 1;

  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  _reason_text := CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN ' Reason: ' || p_reason ELSE '' END;

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.' || _reason_text);

  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 3 WHEN 2 THEN 2 WHEN 3 THEN 1 ELSE 0 END);
    
    SELECT * INTO _member FROM public.profiles WHERE user_id = _ref.referrer_id;
    IF FOUND AND _team_penalty_pct > 0 THEN
      _team_penalty := LEAST(CEIL(_member.credit_score * _team_penalty_pct / 100), _member.credit_score);
      _member_new_credit := GREATEST(0, _member.credit_score - _team_penalty);

      UPDATE public.profiles SET credit_score = _member_new_credit WHERE user_id = _ref.referrer_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_ref.referrer_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _team_penalty || '% (now ' || _member_new_credit || '%) because a Tier ' || _ref.tier || ' team member (' || COALESCE(_user.display_name, 'Unknown') || ') was banned.');
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'ban_count', _new_ban_count, 
    'new_credit_score', _new_credit,
    'ban_expires_at', _ban_expires_at,
    'is_temporary', p_duration_hours IS NOT NULL
  );
END;
$function$;

-- Drop the old single-param ban_user overload
DROP FUNCTION IF EXISTS public.ban_user(uuid);

-- 3. Create get_recent_activity RPC for global marquee
CREATE OR REPLACE FUNCTION public.get_recent_activity()
 RETURNS TABLE(display_name text, amount numeric, type text, created_at timestamptz)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(
      LEFT(COALESCE(p.display_name, 'user'), 3) || '***@gmail.com',
      'use***@gmail.com'
    ) AS display_name,
    t.amount,
    t.type::text,
    t.created_at
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status = 'approved'
    AND t.type IN ('withdrawal', 'deposit', 'commission')
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$function$;
