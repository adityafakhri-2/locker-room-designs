-- Migration: Add testimonial columns and public testimonial function
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS testimonial_text text,
ADD COLUMN IF NOT EXISTS testimonial_photo_url text;

-- Create secure RPC function to fetch public testimonials for completed orders
-- Only exposes safe fields (name, city, delivery type, quote, photo, product names)
CREATE OR REPLACE FUNCTION public.get_public_testimonials(limit_count int DEFAULT 12)
RETURNS TABLE (
  id uuid,
  order_number text,
  recipient_name text,
  recipient_kota text,
  delivery_type text,
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

