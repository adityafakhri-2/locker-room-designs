-- 1. Ubah tipe kolom condition pada products dari enum ke TEXT
ALTER TABLE public.products ALTER COLUMN condition DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN condition TYPE TEXT USING condition::TEXT;
ALTER TABLE public.products ALTER COLUMN condition SET DEFAULT 'excellent';

-- 2. Buat tabel baru untuk mengelola pilihan kondisi
CREATE TABLE public.product_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Masukkan data kondisi default
INSERT INTO public.product_conditions (name) VALUES 
  ('mint'),
  ('excellent'),
  ('good'),
  ('fair')
ON CONFLICT (name) DO NOTHING;

-- 4. Berikan akses ke tabel product_conditions
GRANT SELECT ON public.product_conditions TO anon, authenticated;
GRANT ALL ON public.product_conditions TO authenticated;

-- 5. Aktifkan RLS pada product_conditions
ALTER TABLE public.product_conditions ENABLE ROW LEVEL SECURITY;

-- 6. Buat kebijakan RLS untuk membaca dan menulis
CREATE POLICY "conditions_public_select" ON public.product_conditions FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "conditions_admin_all" ON public.product_conditions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
