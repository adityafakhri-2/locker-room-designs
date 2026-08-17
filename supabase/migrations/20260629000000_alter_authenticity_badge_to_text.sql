-- Convert authenticity_badge column to TEXT to support any grade/badge (grade_ori, original_verified, etc.)
ALTER TABLE public.products ALTER COLUMN authenticity_badge DROP DEFAULT;
ALTER TABLE public.products ALTER COLUMN authenticity_badge TYPE TEXT USING authenticity_badge::TEXT;
