-- =========================================================================
-- PERFORMANCE INDEXES FOR PRODUCTS CATALOG
-- =========================================================================

-- Indeks komposit untuk mempercepat pemindaian (index scan) saat memfilter
-- produk aktif (is_active = true) dan mengurutkannya berdasarkan
-- kriteria yang didukung di halaman katalog toko (shop).

CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON public.products (is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_active_price_asc
  ON public.products (is_active, price ASC);

CREATE INDEX IF NOT EXISTS idx_products_active_price_desc
  ON public.products (is_active, price DESC);

CREATE INDEX IF NOT EXISTS idx_products_active_sold_count_desc
  ON public.products (is_active, sold_count DESC);
