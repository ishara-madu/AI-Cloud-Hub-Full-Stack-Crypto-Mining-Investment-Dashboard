
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

  _today := (now() AT TIME ZONE 'Asia/Colombo')::date;

  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  SELECT credit_score, is_frozen INTO _credit_score, _is_frozen FROM public.profiles WHERE user_id = _user_id;
  _credit_score := COALESCE(_credit_score, 100);

  IF COALESCE(_is_frozen, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is frozen');
  END IF;

  IF _credit_score < 100 THEN
    UPDATE public.profiles SET credit_score = LEAST(100, credit_score + 1) WHERE user_id = _user_id;
    _credit_score := LEAST(100, _credit_score + 1);
  END IF;

  _actual_reward := ROUND((_base_reward * _credit_score / 100)::numeric, 2);
  IF _actual_reward < 1 THEN _actual_reward := 1; END IF;

  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _actual_reward);

  UPDATE public.wallets SET balance = balance + _actual_reward, updated_at = now() WHERE user_id = _user_id;

  -- Record transaction so it shows in Today's Overview and Earned History
  INSERT INTO public.transactions (user_id, type, amount, status, description)
  VALUES (_user_id, 'commission', _actual_reward, 'approved',
    'Daily sign-in reward (Rs ' || _actual_reward::text || ')');

  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward',
    'You received Rs ' || _actual_reward::text || ' for your daily check-in.' ||
    CASE WHEN _credit_score < 100 THEN ' Credit score recovered to ' || _credit_score || '%.' ELSE '' END);

  RETURN jsonb_build_object('success', true, 'reward', _actual_reward, 'credit_score', _credit_score);
END;
$function$;
