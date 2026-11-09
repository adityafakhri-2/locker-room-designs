-- Migration: Add testimonial columns and public testimonial function
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS testimonial_text text,
ADD COLUMN IF NOT EXISTS testimonial_photo_url text,
ADD COLUMN IF NOT EXISTS testimonial_rating int DEFAULT 5 CHECK (testimonial_rating BETWEEN 1 AND 5);

-- Secure RPC function for customer to submit testimonial with interactive star rating
CREATE OR REPLACE FUNCTION public.submit_order_testimonial(
  target_order_id UUID,
  rating INT,
  review_text TEXT,
  photo_url TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders;
BEGIN
  IF rating < 1 OR rating > 5 THEN
    RAISE EXCEPTION 'Rating harus antara 1 sampai 5 bintang';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan';
  END IF;

  IF v_order.user_id != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Anda tidak memiliki hak untuk memberi ulasan pada pesanan ini';
  END IF;

  IF v_order.status != 'delivered' THEN
    RAISE EXCEPTION 'Ulasan hanya dapat diberikan setelah pesanan berstatus Selesai';
  END IF;

  UPDATE public.orders
  SET 
    testimonial_rating = rating,
    testimonial_text = NULLIF(trim(review_text), ''),
    testimonial_photo_url = COALESCE(photo_url, testimonial_photo_url),
    updated_at = now()
  WHERE id = target_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order_testimonial(UUID, INT, TEXT, TEXT) TO authenticated;

-- Create secure RPC function to fetch public testimonials for completed orders
-- Only exposes safe fields (name, city, delivery type, quote, rating, photo, product names)
CREATE OR REPLACE FUNCTION public.get_public_testimonials(limit_count int DEFAULT 12)
RETURNS TABLE (
  id uuid,
  order_number text,
  recipient_name text,
  recipient_kota text,
  delivery_type text,
  testimonial_rating int,
  testimonial_text text,
  photo_url text,
  product_names text[],
  created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.recipient_name,
    o.recipient_kota,
    CASE 
      WHEN o.courier = 'COD' OR o.recipient_alamat LIKE 'COD:%' THEN 'COD (Ketemuan Langsung)'
      ELSE 'Ekspedisi'
    END AS delivery_type,
    COALESCE(o.testimonial_rating, 5) AS testimonial_rating,
    o.testimonial_text,
    COALESCE(o.testimonial_photo_url, o.cod_proof_url) AS photo_url,
    COALESCE(
      (SELECT array_agg(oi.product_name) FROM public.order_items oi WHERE oi.order_id = o.id),
      ARRAY[]::text[]
    ) AS product_names,
    o.created_at
  FROM public.orders o
  WHERE o.status = 'delivered'
    AND (
      o.testimonial_text IS NOT NULL 
      OR o.cod_proof_url IS NOT NULL 
      OR o.testimonial_photo_url IS NOT NULL
    )
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_testimonials(int) TO anon, authenticated;
