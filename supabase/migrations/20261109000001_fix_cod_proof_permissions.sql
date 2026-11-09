-- Migration: Allow admins to insert payment proofs and upload to storage without owner folder constraints

-- 1. Allow admins to insert into public.payment_proofs as well
DROP POLICY IF EXISTS "proofs_insert_own" ON public.payment_proofs;
CREATE POLICY "proofs_insert_own" ON public.payment_proofs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.payments p 
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.id = payment_id 
      AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- 2. Allow admins to upload to payment-proofs storage bucket without strict owner-only folder constraint
DROP POLICY IF EXISTS "proofs_owner_write" ON storage.objects;
CREATE POLICY "proofs_owner_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs' AND (
      (storage.foldername(name))[1] = auth.uid()::text 
      OR public.has_role(auth.uid(), 'admin')
    )
  );

