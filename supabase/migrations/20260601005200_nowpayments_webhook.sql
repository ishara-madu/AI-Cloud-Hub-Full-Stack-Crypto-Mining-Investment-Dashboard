-- Database function to process NOWPayments IPN status updates
CREATE OR REPLACE FUNCTION public.process_nowpayments_deposit(
  p_deposit_id uuid,
  p_payment_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _dep record;
  _bal numeric;
  _new_bal numeric;
  _display_name text;
  _new_status request_status;
  _note_text text;
BEGIN
  -- Get deposit record
  SELECT * INTO _dep FROM public.deposit_requests WHERE id = p_deposit_id;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Deposit request not found'); 
  END IF;
  
  IF _dep.status != 'pending' THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Deposit already processed'); 
  END IF;

  _note_text := 'Cryptocurrency IPN notification received. Payment status: ' || p_payment_status;

  -- Map NOWPayments status to our internal request_status ('pending', 'approved', 'rejected')
  IF p_payment_status = 'finished' OR p_payment_status = 'confirmed' THEN
    _new_status := 'approved';
  ELSIF p_payment_status = 'failed' OR p_payment_status = 'expired' OR p_payment_status = 'refunded' THEN
    _new_status := 'rejected';
  ELSE
    -- For any other statuses (like 'waiting', 'confirming', 'sending'), update notes but keep status pending
    UPDATE public.deposit_requests 
    SET notes = COALESCE(notes, '') || E'\n' || _note_text, updated_at = now() 
    WHERE id = p_deposit_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Status updated (still pending)');
  END IF;

  IF _new_status = 'approved' THEN
    -- Lock wallet and get balance
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _dep.user_id FOR UPDATE;
    IF NOT FOUND THEN 
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found'); 
    END IF;

    -- Update deposit status
    UPDATE public.deposit_requests 
    SET status = 'approved', 
        notes = COALESCE(notes, '') || E'\n' || _note_text, 
        updated_at = now() 
    WHERE id = p_deposit_id;

    -- Credit user wallet
    UPDATE public.wallets 
    SET balance = balance + _dep.amount, 
        total_deposited = total_deposited + _dep.amount, 
        updated_at = now() 
    WHERE user_id = _dep.user_id;

    -- Verify balance integrity
    SELECT balance INTO _new_bal FROM public.wallets WHERE user_id = _dep.user_id;

    -- Update/insert transaction record
    UPDATE public.transactions 
    SET status = 'approved', 
        description = 'Crypto Deposit completed via Cryptocurrency'
    WHERE user_id = _dep.user_id 
      AND type = 'deposit' 
      AND status = 'pending' 
      AND reference_id = p_deposit_id;

    IF NOT FOUND THEN
      INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
      VALUES (_dep.user_id, 'deposit', _dep.amount, 'approved', 'Crypto Deposit completed via Cryptocurrency', p_deposit_id);
    END IF;

    -- Send notification to user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_dep.user_id, 'money', 'Deposit Approved ✅',
      'Your crypto deposit of Rs ' || _dep.amount::text || ' has been automatically processed and credited to your wallet.');

    -- Integrity check alert
    IF abs(_new_bal - (_bal + _dep.amount)) > 0.01 THEN
      INSERT INTO public.admin_alerts (alert_type, severity, title, description, related_user_ids)
      VALUES ('integrity_error', 'critical', '⚠️ Balance Mismatch on Crypto Deposit',
        'Expected: Rs ' || (_bal + _dep.amount)::text || ', Actual: Rs ' || _new_bal::text, ARRAY[_dep.user_id]);
    END IF;

    -- Distribute referral commissions
    DECLARE
      _rates jsonb;
      _ref record;
      _rate numeric;
      _comm_amount numeric;
      _earner_credit integer;
    BEGIN
      SELECT value INTO _rates FROM public.platform_settings WHERE key = 'commission_rates';
      IF _rates IS NOT NULL THEN
        FOR _ref IN SELECT referrer_id, tier FROM public.referrals WHERE referred_id = _dep.user_id LOOP
          _rate := CASE _ref.tier
            WHEN 1 THEN COALESCE((_rates->>'level_1')::numeric, 0)
            WHEN 2 THEN COALESCE((_rates->>'level_2')::numeric, 0)
            WHEN 3 THEN COALESCE((_rates->>'level_3')::numeric, 0)
            ELSE 0
          END;
          IF _rate <= 0 THEN CONTINUE; END IF;

          -- Scale commission by earner's credit score
          SELECT credit_score INTO _earner_credit FROM public.profiles WHERE user_id = _ref.referrer_id;
          _earner_credit := COALESCE(_earner_credit, 100);
          
          _comm_amount := ROUND((_dep.amount * _rate / 100 * _earner_credit / 100)::numeric, 2);
          IF _comm_amount < 0.01 THEN CONTINUE; END IF;

          INSERT INTO public.commissions (user_id, amount, tier, from_user_id, source_type, source_id)
          VALUES (_ref.referrer_id, _comm_amount, _ref.tier, _dep.user_id, 'deposit', p_deposit_id);

          UPDATE public.wallets 
          SET balance = balance + _comm_amount, 
              total_commission = total_commission + _comm_amount, 
              updated_at = now()
          WHERE user_id = _ref.referrer_id;

          INSERT INTO public.transactions (user_id, type, amount, status, description, reference_id)
          VALUES (_ref.referrer_id, 'commission', _comm_amount, 'approved', 
            'Tier ' || _ref.tier || ' commission' || CASE WHEN _earner_credit < 100 THEN ' (Credit: ' || _earner_credit || '%)' ELSE '' END, p_deposit_id);

          INSERT INTO public.notifications (user_id, type, title, description)
          VALUES (_ref.referrer_id, 'money', 'Commission Earned 🎉',
            'You earned Rs ' || _comm_amount::text || ' (Tier ' || _ref.tier || ') from a team member''s deposit.');
        END LOOP;
      END IF;
    END;

    RETURN jsonb_build_object('success', true, 'status', 'approved');

  ELSIF _new_status = 'rejected' THEN
    -- Update deposit status to rejected
    UPDATE public.deposit_requests 
    SET status = 'rejected', 
        notes = COALESCE(notes, '') || E'\n' || _note_text, 
        updated_at = now() 
    WHERE id = p_deposit_id;

    -- Update transactions status to rejected
    UPDATE public.transactions 
    SET status = 'rejected', 
        description = 'Crypto Deposit failed: ' || p_payment_status
    WHERE user_id = _dep.user_id 
      AND type = 'deposit' 
      AND status = 'pending' 
      AND reference_id = p_deposit_id;

    -- Send notification to user
    INSERT INTO public.notifications (user_id, type, title, description)
    VALUES (_dep.user_id, 'system', 'Deposit Failed ❌',
      'Your crypto deposit of Rs ' || _dep.amount::text || ' has failed. Status: ' || p_payment_status);

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unexpected execution path');
END;
$$;

-- Secure the function so it can't be called by standard anonymous or authenticated users via REST API
REVOKE EXECUTE ON FUNCTION public.process_nowpayments_deposit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_nowpayments_deposit(uuid, text) TO postgres, service_role;
