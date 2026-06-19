-- 1. Izinkan pemilik order mengupdate record payment mereka sendiri (untuk status waiting_verification)
CREATE POLICY "payments_update_own" ON public.payments
FOR UPDATE TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
)
WITH CHECK (
  auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
);

-- 2. Buat fungsi RPC untuk membatalkan pesanan milik sendiri secara aman
CREATE OR REPLACE FUNCTION public.cancel_own_order(target_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_own_order(UUID) TO authenticated;
