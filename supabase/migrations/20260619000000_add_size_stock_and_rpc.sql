-- 1. Buat fungsi RPC untuk memeriksa apakah sudah ada pengguna terdaftar
CREATE OR REPLACE FUNCTION public.has_registered_users()
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1);
$$;
GRANT EXECUTE ON FUNCTION public.has_registered_users() TO anon, authenticated;

-- 2. Tambah kolom size_stock ke tabel products
ALTER TABLE public.products ADD COLUMN size_stock JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 3. Inisialisasi size_stock untuk produk yang sudah ada
-- Mengisi default stok rata untuk setiap ukuran produk yang terdaftar
UPDATE public.products
SET size_stock = (
  SELECT jsonb_object_agg(sz, CEIL(stock::float / GREATEST(cardinality(sizes), 1))::int)
  FROM unnest(sizes) AS sz
)
WHERE cardinality(sizes) > 0;

-- 4. Update trigger on_payment_approved agar memotong stok ukuran spesifik
CREATE OR REPLACE FUNCTION public.on_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Potong stok umum produk
    UPDATE public.products p
       SET stock = GREATEST(stock - oi.quantity, 0),
           sold_count = sold_count + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.order_id AND oi.product_id = p.id;
     
    -- Potong stok ukuran spesifik
    FOR r IN SELECT product_id, size, quantity FROM public.order_items WHERE order_id = NEW.order_id LOOP
      UPDATE public.products
         SET size_stock = jsonb_set(
               size_stock,
               array[r.size],
               to_jsonb(GREATEST(COALESCE((size_stock->>r.size)::int, 0) - r.quantity, 0))
             )
       WHERE id = r.product_id;
    END LOOP;

    UPDATE public.orders SET status = 'paid' WHERE id = NEW.order_id AND status = 'pending';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 5. Izinkan penghapusan pesanan oleh Admin
GRANT DELETE ON public.orders TO authenticated;
CREATE POLICY "orders_admin_delete" ON public.orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Izinkan Admin melihat semua data Profil
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

