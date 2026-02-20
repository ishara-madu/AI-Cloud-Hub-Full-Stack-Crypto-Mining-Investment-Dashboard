
-- Drop and recreate with description column
DROP FUNCTION IF EXISTS public.get_recent_activity();

CREATE OR REPLACE FUNCTION public.get_recent_activity()
 RETURNS TABLE(display_name text, amount numeric, type text, created_at timestamp with time zone, description text)
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
    t.created_at,
    t.description
  FROM public.transactions t
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  WHERE t.status = 'approved'
    AND t.type IN ('withdrawal', 'deposit', 'commission', 'refund')
  ORDER BY t.created_at DESC
  LIMIT 50;
END;
$function$;
