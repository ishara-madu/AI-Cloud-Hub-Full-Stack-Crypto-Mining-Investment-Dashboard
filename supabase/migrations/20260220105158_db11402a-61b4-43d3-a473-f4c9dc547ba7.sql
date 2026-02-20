
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id uuid, p_duration_hours integer DEFAULT NULL::integer, p_reason text DEFAULT NULL::text)
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
  _sub record;
  _sub_profile record;
  _sub_penalty_pct numeric;
  _sub_penalty integer;
  _sub_new_credit integer;
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

  -- Self penalty: 20% per ban (escalating)
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

  -- UPWARD cascade: penalize referrers (reduced rates: Tier1=1%, Tier2=0.5%, Tier3=0.25%)
  FOR _ref IN 
    SELECT referrer_id, tier FROM public.referrals WHERE referred_id = p_user_id
  LOOP
    _team_penalty_pct := _new_ban_count * (CASE _ref.tier WHEN 1 THEN 1.0 WHEN 2 THEN 0.5 WHEN 3 THEN 0.25 ELSE 0 END);
    
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

  -- DOWNWARD cascade: penalize team members (reduced rates: Tier1=1%, Tier2=0.5%, Tier3=0.25%)
  FOR _sub IN 
    SELECT referred_id, tier FROM public.referrals WHERE referrer_id = p_user_id
  LOOP
    _sub_penalty_pct := _new_ban_count * (CASE _sub.tier WHEN 1 THEN 1.0 WHEN 2 THEN 0.5 WHEN 3 THEN 0.25 ELSE 0 END);
    
    SELECT * INTO _sub_profile FROM public.profiles WHERE user_id = _sub.referred_id;
    IF FOUND AND _sub_penalty_pct > 0 THEN
      _sub_penalty := LEAST(CEIL(_sub_profile.credit_score * _sub_penalty_pct / 100), _sub_profile.credit_score);
      _sub_new_credit := GREATEST(0, _sub_profile.credit_score - _sub_penalty);

      UPDATE public.profiles SET credit_score = _sub_new_credit WHERE user_id = _sub.referred_id;

      INSERT INTO public.notifications (user_id, type, title, description)
      VALUES (_sub.referred_id, 'security', 'Credit Score Decreased ⚠️',
        'Your credit score decreased by ' || _sub_penalty || '% (now ' || _sub_new_credit || '%) because your team leader (' || COALESCE(_user.display_name, 'Unknown') || ') was banned. Reason: ' || COALESCE(p_reason, 'Not specified'));
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
