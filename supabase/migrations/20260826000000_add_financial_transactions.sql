-- Migration: Add financial_transactions table for expense and capital management
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('in', 'out')),
    category TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists (safety)
DROP POLICY IF EXISTS "admin_all_financial_transactions" ON public.financial_transactions;

-- Policy: Admin has full access
CREATE POLICY "admin_all_financial_transactions" 
ON public.financial_transactions 
FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Grant access to authenticated users (admin role check is done via RLS policy)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_transactions TO authenticated;
