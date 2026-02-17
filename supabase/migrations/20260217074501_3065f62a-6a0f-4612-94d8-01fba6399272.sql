
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    code TEXT;
BEGIN
    code := upper(substring(md5(random()::text) from 1 for 8));
    RETURN code;
END;
$$;
