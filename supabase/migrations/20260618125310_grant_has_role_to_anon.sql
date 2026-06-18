-- Grant execute on has_role to anon to fix RLS policy evaluation for guest users
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
