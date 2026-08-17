-- Migration: Add cost_price to products and order_items
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0;
