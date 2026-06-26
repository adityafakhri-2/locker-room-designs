-- 1. Fungsi trigger untuk mengembalikan stok dan mengurangi sold_count saat pesanan dihapus
CREATE OR REPLACE FUNCTION public.restore_stock_on_order_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  -- A. Kembalikan stok untuk setiap item di order tersebut jika status pesanan bukan 'cancelled'
  -- (Karena jika status 'cancelled', stok sudah dikembalikan sebelumnya oleh trigger cancel)
  IF OLD.status <> 'cancelled' THEN
    FOR r IN SELECT product_id, size, quantity FROM public.order_items WHERE order_id = OLD.id LOOP
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
  END IF;

  -- B. Jika order sudah dibayar/proses lalu di-delete, kurangi sold_count produk
  IF OLD.status IN ('paid', 'processing', 'shipped', 'delivered') THEN
    UPDATE public.products p
       SET sold_count = GREATEST(sold_count - oi.quantity, 0)
      FROM public.order_items oi
     WHERE oi.order_id = OLD.id AND oi.product_id = p.id;
  END IF;

  RETURN OLD;
END;
$$;

-- 2. Buat trigger BEFORE DELETE pada tabel orders
CREATE OR REPLACE TRIGGER trg_restore_stock_on_order_delete
BEFORE DELETE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_order_delete();


-- 3. Sinkronisasi Ulang Data Historis (Koreksi data sold_count produk saat ini)
-- Reset sold_count ke 0 terlebih dahulu
UPDATE public.products SET sold_count = 0;

-- Hitung ulang dan perbarui dari pesanan valid yang ada sekarang
UPDATE public.products p
SET sold_count = COALESCE(sub.total_qty, 0)
FROM (
  SELECT oi.product_id, SUM(oi.quantity) as total_qty
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('paid', 'processing', 'shipped', 'delivered')
  GROUP BY oi.product_id
) sub
WHERE p.id = sub.product_id;
