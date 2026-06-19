-- 1. Update trigger function on_payment_approved agar mengubah status order langsung ke 'processing' (dikemas)
CREATE OR REPLACE FUNCTION public.on_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Hanya update sold_count untuk produk yang terjual
    UPDATE public.products p
       SET sold_count = sold_count + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.order_id AND oi.product_id = p.id;
     
    -- Update status pesanan menjadi processing (dikemas)
    UPDATE public.orders SET status = 'processing' WHERE id = NEW.order_id AND status = 'pending';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2. Buat fungsi RPC untuk mengonfirmasi penerimaan pesanan oleh customer
CREATE OR REPLACE FUNCTION public.confirm_delivery_own_order(target_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'delivered'
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND status = 'shipped';
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_own_order(UUID) TO authenticated;
