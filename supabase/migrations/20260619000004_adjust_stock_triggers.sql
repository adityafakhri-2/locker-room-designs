-- 1. Trigger untuk memotong stok produk seketika saat order_item ditambahkan (Checkout)
CREATE OR REPLACE FUNCTION public.decrease_stock_on_order_item()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Kurangi stok umum produk
  UPDATE public.products
  SET stock = GREATEST(stock - NEW.quantity, 0)
  WHERE id = NEW.product_id;

  -- Kurangi stok ukuran spesifik (JSONB)
  UPDATE public.products
  SET size_stock = jsonb_set(
        size_stock,
        array[NEW.size],
        to_jsonb(GREATEST(COALESCE((size_stock->>NEW.size)::int, 0) - NEW.quantity, 0))
      )
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_decrease_stock_on_order_item
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.decrease_stock_on_order_item();


-- 2. Trigger untuk mengembalikan stok produk saat status pesanan diubah menjadi 'cancelled'
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    -- Kembalikan stok untuk setiap item di order tersebut
    FOR r IN SELECT product_id, size, quantity FROM public.order_items WHERE order_id = NEW.id LOOP
      -- Kembalikan stok umum
      UPDATE public.products
      SET stock = stock + r.quantity
      WHERE id = r.product_id;

      -- Kembalikan stok ukuran spesifik (JSONB)
      UPDATE public.products
      SET size_stock = jsonb_set(
            size_stock,
            array[r.size],
            to_jsonb(COALESCE((size_stock->>r.size)::int, 0) + r.quantity)
          )
      WHERE id = r.product_id;
    END LOOP;

    -- Jika order sebelumnya sudah dibayar (status paid, processing, dll) lalu di-cancel, kurangi sold_count
    IF OLD.status IN ('paid', 'processing', 'shipped', 'delivered') THEN
      UPDATE public.products p
         SET sold_count = GREATEST(sold_count - oi.quantity, 0)
        FROM public.order_items oi
       WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_restore_stock_on_order_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_order_cancel();


-- 3. Update trigger on_payment_approved agar tidak lagi memotong stok (hanya mengupdate sold_count & status order)
CREATE OR REPLACE FUNCTION public.on_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Hanya update sold_count untuk produk yang terjual
    UPDATE public.products p
       SET sold_count = sold_count + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.order_id AND oi.product_id = p.id;
     
    -- Update status pesanan menjadi paid
    UPDATE public.orders SET status = 'paid' WHERE id = NEW.order_id AND status = 'pending';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
