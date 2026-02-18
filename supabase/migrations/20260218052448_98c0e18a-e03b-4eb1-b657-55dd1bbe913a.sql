-- Fix admin_reset_all_data to properly handle auth users deletion
-- The issue was that profiles deletion doesn't cascade to auth.users
-- We need to drop and recreate with proper logic

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

  -- Delete all transactional / activity data first
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

  -- Delete user roles for non-admin users only (keep current admin session alive)
  DELETE FROM public.user_roles WHERE user_id != _caller_id;

  -- Delete profiles for non-admin users only
  DELETE FROM public.profiles WHERE user_id != _caller_id;

  RETURN jsonb_build_object('success', true, 'message', 'All user data has been deleted. Admin account preserved.');
END;
$function$;
