-- Remove default deposit bank details from platform settings
DELETE FROM public.platform_settings WHERE key = 'deposit_bank';
