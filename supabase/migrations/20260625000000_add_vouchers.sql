-- Create vouchers table
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'nominal')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  min_purchase NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_purchase >= 0),
  max_discount NUMERIC(12,2) CHECK (max_discount > 0),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  usage_limit INT CHECK (usage_limit > 0),
  usage_count INT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grant roles
GRANT SELECT ON public.vouchers TO anon, authenticated;
GRANT ALL ON public.vouchers TO service_role;
GRANT ALL ON public.vouchers TO authenticated;

-- Enable RLS
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

-- Read policy (authenticated users can read vouchers)
CREATE POLICY "vouchers_read_policy" ON public.vouchers
  FOR SELECT TO authenticated USING (true);

-- Admin policy (admins can do everything)
CREATE POLICY "vouchers_admin_policy" ON public.vouchers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Update orders table
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Trigger to increment usage count when order is placed
CREATE OR REPLACE FUNCTION public.handle_voucher_usage_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.voucher_id IS NOT NULL THEN
    UPDATE public.vouchers
    SET 
      usage_count = usage_count + 1,
      status = CASE 
        WHEN usage_limit IS NOT NULL AND (usage_count + 1) >= usage_limit THEN 'inactive'::text 
        ELSE status 
      END
    WHERE id = NEW.voucher_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_order_placed_use_voucher ON public.orders;

CREATE TRIGGER on_order_placed_use_voucher
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_voucher_usage_on_order();
