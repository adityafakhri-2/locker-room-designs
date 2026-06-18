
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('waiting_payment', 'waiting_verification', 'approved', 'rejected');
CREATE TYPE public.condition_rating AS ENUM ('mint', 'excellent', 'good', 'fair');
CREATE TYPE public.authenticity_badge AS ENUM ('original_verified', 'match_worn', 'collector_item', 'limited_edition');

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama_lengkap TEXT,
  email TEXT,
  no_hp TEXT,
  alamat TEXT,
  kota TEXT,
  provinsi TEXT,
  kode_pos TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_own_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_own_select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- HANDLE NEW USER: first user becomes admin
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, nama_lengkap)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first THEN 'admin'::public.app_role ELSE 'customer'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- CATEGORIES
-- =========================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_admin_all" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- PRODUCTS
-- =========================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  brand TEXT,
  team TEXT,
  league TEXT,
  country TEXT,
  release_year INT,
  condition public.condition_rating,
  sizes TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  story TEXT,
  collector_score INT NOT NULL DEFAULT 1 CHECK (collector_score BETWEEN 1 AND 3),
  authenticity_badge public.authenticity_badge,
  video_url TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_best_seller BOOLEAN NOT NULL DEFAULT false,
  sold_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "products_admin_all" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);

-- =========================================
-- PRODUCT IMAGES
-- =========================================
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_public_read" ON public.product_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "product_images_admin_all" ON public.product_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_product_images_product ON public.product_images(product_id);

-- =========================================
-- PRODUCT CERTIFICATES
-- =========================================
CREATE TABLE public.product_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  certificate_number TEXT NOT NULL,
  proof_image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_certificates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_certificates TO authenticated;
GRANT ALL ON public.product_certificates TO service_role;
ALTER TABLE public.product_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certs_public_read" ON public.product_certificates FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "certs_admin_all" ON public.product_certificates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- FEATURED COLLECTIONS
-- =========================================
CREATE TABLE public.featured_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  cover_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.featured_collections TO authenticated;
GRANT ALL ON public.featured_collections TO service_role;
ALTER TABLE public.featured_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fc_public_read" ON public.featured_collections FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "fc_admin_all" ON public.featured_collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.featured_collection_products (
  collection_id UUID NOT NULL REFERENCES public.featured_collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id)
);
GRANT SELECT ON public.featured_collection_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.featured_collection_products TO authenticated;
GRANT ALL ON public.featured_collection_products TO service_role;
ALTER TABLE public.featured_collection_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fcp_public_read" ON public.featured_collection_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fcp_admin_all" ON public.featured_collection_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- WISHLISTS
-- =========================================
CREATE TABLE public.wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlists_own" ON public.wishlists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlists_admin_read" ON public.wishlists FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================
-- CART ITEMS
-- =========================================
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size TEXT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, size)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_own" ON public.cart_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- ADDRESSES
-- =========================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  recipient_name TEXT NOT NULL,
  no_hp TEXT NOT NULL,
  alamat TEXT NOT NULL,
  kota TEXT NOT NULL,
  provinsi TEXT NOT NULL,
  kode_pos TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_own" ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- ORDERS
-- =========================================
CREATE SEQUENCE public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_order_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT;
BEGIN
  n := nextval('public.order_number_seq');
  RETURN 'TLR-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
END;
$$;

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT public.next_order_number(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  courier TEXT,
  tracking_number TEXT,
  recipient_name TEXT NOT NULL,
  recipient_no_hp TEXT NOT NULL,
  recipient_alamat TEXT NOT NULL,
  recipient_kota TEXT NOT NULL,
  recipient_provinsi TEXT NOT NULL,
  recipient_kode_pos TEXT NOT NULL,
  note TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_own_select" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "orders_own_insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- Append to timeline on status change
CREATE OR REPLACE FUNCTION public.orders_timeline_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (NEW.status IS DISTINCT FROM OLD.status) THEN
    NEW.timeline := COALESCE(NEW.timeline,'[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('status', NEW.status, 'at', now())
    );
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_timeline BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_timeline_trigger();

-- =========================================
-- ORDER ITEMS
-- =========================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_slug TEXT,
  image_url TEXT,
  size TEXT,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'manual_transfer',
  bank TEXT,
  amount NUMERIC(12,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'waiting_payment',
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "payments_insert_own" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "payments_admin_update" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- decrement stock when payment approved
CREATE OR REPLACE FUNCTION public.on_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE public.products p
       SET stock = GREATEST(stock - oi.quantity, 0),
           sold_count = sold_count + oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = NEW.order_id AND oi.product_id = p.id;
    UPDATE public.orders SET status = 'paid' WHERE id = NEW.order_id AND status = 'pending';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_payment_approved BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_approved();

-- =========================================
-- PAYMENT PROOFS
-- =========================================
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_proofs TO authenticated;
GRANT ALL ON public.payment_proofs TO service_role;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proofs_select" ON public.payment_proofs FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.payments p JOIN public.orders o ON o.id = p.order_id
          WHERE p.id = payment_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "proofs_insert_own" ON public.payment_proofs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.payments p JOIN public.orders o ON o.id = p.order_id
          WHERE p.id = payment_id AND o.user_id = auth.uid())
);

-- =========================================
-- SHIPMENTS
-- =========================================
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  courier TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipments_select" ON public.shipments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "shipments_admin_write" ON public.shipments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================
-- REVIEWS
-- =========================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  photos TEXT[] NOT NULL DEFAULT '{}',
  approved BOOLEAN NOT NULL DEFAULT false,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT TO anon, authenticated USING ((approved AND NOT hidden) OR auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reviews_own_insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reviews_own_update" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "reviews_admin_delete" ON public.reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- =========================================
-- FUTURE READY (schema only)
-- =========================================
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.payment_methods TO anon, authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm_public_read" ON public.payment_methods FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.loyalty_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_points TO authenticated;
GRANT ALL ON public.loyalty_points TO service_role;
ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty_own" ON public.loyalty_points FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON public.referrals FOR SELECT TO authenticated USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

CREATE TABLE public.auctions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  starting_price NUMERIC(12,2) NOT NULL,
  current_bid NUMERIC(12,2),
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.auctions TO anon, authenticated;
GRANT ALL ON public.auctions TO service_role;
ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auctions_public_read" ON public.auctions FOR SELECT TO anon, authenticated USING (is_active);

-- =========================================
-- SEED CATEGORIES & PAYMENT METHODS
-- =========================================
INSERT INTO public.categories (slug, name, sort_order) VALUES
  ('new-season', 'New Season Jerseys', 1),
  ('vintage', 'Vintage Jerseys', 2),
  ('retro', 'Retro Collection', 3),
  ('national-teams', 'National Teams', 4),
  ('club-teams', 'Club Teams', 5),
  ('limited-edition', 'Limited Edition', 6)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.payment_methods (code, name, is_active) VALUES
  ('manual_transfer', 'Transfer Bank Manual', true),
  ('midtrans', 'Midtrans', false),
  ('qris', 'QRIS', false),
  ('ewallet', 'E-Wallet', false)
ON CONFLICT (code) DO NOTHING;
