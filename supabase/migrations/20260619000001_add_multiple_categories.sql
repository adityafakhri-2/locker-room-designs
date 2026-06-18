-- 1. Tambah kolom category_ids (tipe array UUID) ke tabel products
ALTER TABLE public.products ADD COLUMN category_ids UUID[] NOT NULL DEFAULT '{}'::uuid[];

-- 2. Migrasikan data dari kolom category_id yang lama ke category_ids
UPDATE public.products
SET category_ids = ARRAY[category_id]::uuid[]
WHERE category_id IS NOT NULL;

-- 3. Indeks array category_ids untuk kecepatan pencarian
CREATE INDEX idx_products_category_ids ON public.products USING GIN (category_ids);
