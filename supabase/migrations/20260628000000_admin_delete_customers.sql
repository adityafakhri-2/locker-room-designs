-- Migration: Allow admin to delete customers safely
GRANT DELETE ON public.profiles TO authenticated;
GRANT DELETE ON public.user_roles TO authenticated;
GRANT DELETE ON public.addresses TO authenticated;
GRANT DELETE ON public.wishlists TO authenticated;
GRANT DELETE ON public.cart_items TO authenticated;

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to safely batch delete customers
CREATE OR REPLACE FUNCTION public.admin_delete_customers(customer_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus pelanggan';
  END IF;

  -- Delete associated user data
  DELETE FROM public.wishlists WHERE user_id = ANY(customer_ids);
  DELETE FROM public.cart_items WHERE user_id = ANY(customer_ids);
  DELETE FROM public.addresses WHERE user_id = ANY(customer_ids);
  DELETE FROM public.user_roles WHERE user_id = ANY(customer_ids) AND role = 'customer';
  DELETE FROM public.profiles WHERE id = ANY(customer_ids);
END;
$$;
