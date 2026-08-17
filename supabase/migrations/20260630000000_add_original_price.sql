-- Add original_price to products for discount/slashed price marketing gimmick
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2) DEFAULT NULL;
