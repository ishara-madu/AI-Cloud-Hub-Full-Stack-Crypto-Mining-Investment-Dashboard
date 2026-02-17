
-- Atomic daily check-in function (fixes wallet not updating due to missing RLS UPDATE policy)
CREATE OR REPLACE FUNCTION public.daily_checkin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _today date;
  _reward numeric := 10;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  _today := CURRENT_DATE;

  -- Check if already signed in
  IF EXISTS (SELECT 1 FROM public.daily_signins WHERE user_id = _user_id AND signed_in_date = _today) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already signed in today');
  END IF;

  -- Insert sign-in record
  INSERT INTO public.daily_signins (user_id, signed_in_date, reward_amount)
  VALUES (_user_id, _today, _reward);

  -- Credit wallet
  UPDATE public.wallets SET balance = balance + _reward, updated_at = now() WHERE user_id = _user_id;

  -- Create notification
  INSERT INTO public.notifications (user_id, type, title, description)
  VALUES (_user_id, 'money', 'Daily Sign-In Reward', 'You received Rs 10 for your daily check-in. Keep your streak going!');

  RETURN jsonb_build_object('success', true, 'reward', _reward);
END;
$$;
