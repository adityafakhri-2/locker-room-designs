-- Add is_spotlight column to products table for featured spotlight on homepage
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_spotlight BOOLEAN DEFAULT FALSE;
