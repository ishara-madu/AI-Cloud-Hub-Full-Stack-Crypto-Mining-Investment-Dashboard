-- Add temp ban expiry column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ban_expires_at timestamptz DEFAULT NULL;

-- Update ban_user function to accept optional duration
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL)
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

  -- Calculate ban expiry (NULL = permanent)
  IF p_duration_hours IS NOT NULL AND p_duration_hours > 0 THEN
    _ban_expires_at := now() + (p_duration_hours || ' hours')::interval;
  ELSE
    _ban_expires_at := NULL;
  END IF;

  -- Self penalty: 20% per ban (escalating)
  _self_penalty := LEAST(_new_ban_count * 20, _user.credit_score);
  _new_credit := GREATEST(0, _user.credit_score - _self_penalty);

  -- Freeze and update credit score + expiry
  UPDATE public.profiles 
  SET is_frozen = true, ban_count = _new_ban_count, credit_score = _new_credit, ban_expires_at = _ban_expires_at
  WHERE user_id = p_user_id;

  -- Notify banned user
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (p_user_id, 'security', 'Account Frozen 🔒',
    'Your account has been frozen (Ban #' || _new_ban_count || ').' ||
    CASE WHEN _ban_expires_at IS NOT NULL 
      THEN ' Temporary ban — auto-unfreezes at ' || to_char(_ban_expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC.'
      ELSE ' Permanent ban.'
    END ||
    ' Credit score decreased to ' || _new_credit || '%.');

  -- Team impact
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

-- Function to auto-unfreeze expired temp bans (can be called periodically)
CREATE OR REPLACE FUNCTION public.process_expired_bans()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user record;
  _unfrozen integer := 0;
BEGIN
  FOR _user IN
    SELECT user_id, display_name FROM public.profiles
    WHERE is_frozen = true 
      AND ban_expires_at IS NOT NULL 
      AND ban_expires_at <= now()
  LOOP
    UPDATE public.profiles 
    SET is_frozen = false, ban_expires_at = NULL 
    WHERE user_id = _user.user_id;

    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_user.user_id, 'security', 'Account Unfrozen ✅',
      'Your temporary ban has expired. Your account is now active again.');

    _unfrozen := _unfrozen + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'unfrozen_count', _unfrozen);
END;
$function$;

-- Function to completely reset all user data (dangerous - requires explicit admin call)
CREATE OR REPLACE FUNCTION public.admin_reset_all_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_id uuid;
BEGIN
  _caller_id := auth.uid();
  IF NOT public.has_role(_caller_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  -- Delete all user data (cascade will handle most)
  DELETE FROM public.transactions;
  DELETE FROM public.commissions;
  DELETE FROM public.daily_signins;
  DELETE FROM public.device_logs;
  DELETE FROM public.notifications;
  DELETE FROM public.redeem_code_uses;
  DELETE FROM public.referrals;
  DELETE FROM public.user_packages;
  DELETE FROM public.withdrawal_requests;
  DELETE FROM public.deposit_requests;
  DELETE FROM public.bank_accounts;
  DELETE FROM public.wallets;
  DELETE FROM public.admin_alerts;
  DELETE FROM public.user_roles;
  DELETE FROM public.profiles;

  RETURN jsonb_build_object('success', true, 'message', 'All user data has been deleted');
END;
$function$;