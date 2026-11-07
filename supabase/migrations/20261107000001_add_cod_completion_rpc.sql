-- Migration: Add secure RPC for customers to confirm/complete their COD order
CREATE OR REPLACE FUNCTION public.confirm_cod_own_order(
  target_order_id UUID,
  proof_url TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payment_id UUID;
BEGIN
  -- 1. Verifikasi bahwa pesanan adalah milik user yang sedang login, bertipe COD, dan berstatus 'processing'
  UPDATE public.orders
  SET status = 'delivered',
      cod_status = 'delivered',
      cod_proof_url = COALESCE(proof_url, cod_proof_url),
      updated_at = now()
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND status = 'processing'
    AND courier = 'COD';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan atau tidak dapat diselesaikan.';
  END IF;

  -- 2. Dapatkan payment_id untuk pesanan ini dan update status pembayarannya ke approved
  SELECT id INTO v_payment_id
  FROM public.payments
  WHERE order_id = target_order_id
  LIMIT 1;

  IF v_payment_id IS NOT NULL THEN
    UPDATE public.payments
    SET status = 'approved',
        verified_at = now(),
        updated_at = now()
    WHERE id = v_payment_id;

    -- Simpan bukti foto ke payment_proofs jika ada
    IF proof_url IS NOT NULL THEN
      INSERT INTO public.payment_proofs (payment_id, image_url)
      VALUES (v_payment_id, proof_url);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_cod_own_order(UUID, TEXT) TO authenticated;

-- Update confirm_delivery_own_order agar juga mendukung pesanan COD yang sedang diproses
CREATE OR REPLACE FUNCTION public.confirm_delivery_own_order(target_order_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'delivered',
      cod_status = CASE WHEN courier = 'COD' THEN 'delivered' ELSE cod_status END,
      updated_at = now()
  WHERE id = target_order_id
    AND user_id = auth.uid()
    AND (status = 'shipped' OR (status = 'processing' AND courier = 'COD'));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pesanan tidak ditemukan atau tidak dapat diselesaikan.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_own_order(UUID) TO authenticated;

