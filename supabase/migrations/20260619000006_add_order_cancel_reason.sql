-- 1. Tambah kolom cancel_reason di public.orders
ALTER TABLE public.orders ADD COLUMN cancel_reason TEXT;

-- 2. Update fungsi check_and_cancel_expired_orders() untuk mengisi 'timeout'
CREATE OR REPLACE FUNCTION public.check_and_cancel_expired_orders()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled',
      cancel_reason = 'timeout'
  WHERE status = 'pending'
    AND created_at < now() - INTERVAL '24 hours';
END;
$$;

-- 3. Update fungsi cancel_own_order() untuk mengisi 'customer'
CREATE OR REPLACE FUNCTION public.cancel_own_order(target_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled',
      cancel_reason = 'customer'
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND status = 'pending';
END;
$$;

-- 4. Buat trigger/fungsi untuk mengeset default cancel_reason ke 'admin' jika status berubah jadi cancelled secara langsung (oleh admin)
CREATE OR REPLACE FUNCTION public.set_default_cancel_reason()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled' OR OLD.status IS NULL) AND NEW.cancel_reason IS NULL THEN
    NEW.cancel_reason := 'admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_set_default_cancel_reason
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.set_default_cancel_reason();
