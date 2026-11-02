-- Migration: Add platform_fee to orders table
-- Biaya platform / potongan marketplace (Shopee, Tokopedia, TikTok Shop, dll)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

