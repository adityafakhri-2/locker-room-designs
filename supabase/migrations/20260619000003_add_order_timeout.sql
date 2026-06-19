-- Create RPC function to check and cancel expired pending orders (24 hours)
CREATE OR REPLACE FUNCTION public.check_and_cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_cancel_expired_orders() TO anon, authenticated;
