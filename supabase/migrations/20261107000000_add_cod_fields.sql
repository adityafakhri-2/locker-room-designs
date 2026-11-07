-- Migration: Add COD (Ketemuan Langsung) fields to orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS cod_location TEXT,
  ADD COLUMN IF NOT EXISTS cod_date TEXT,
  ADD COLUMN IF NOT EXISTS cod_time_slot TEXT,
  ADD COLUMN IF NOT EXISTS cod_alt_phone TEXT,
  ADD COLUMN IF NOT EXISTS cod_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS cod_status TEXT;

-- Update timeout check to exclude COD orders (so they aren't auto-cancelled after 24h while waiting for meeting date)
CREATE OR REPLACE FUNCTION public.check_and_cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled',
      cancel_reason = 'timeout'
  WHERE status = 'pending'
    AND (courier IS NULL OR courier <> 'COD')
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

