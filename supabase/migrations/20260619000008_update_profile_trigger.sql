-- Update handle_new_user to copy additional address metadata from raw_user_meta_data to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, nama_lengkap, no_hp, alamat, kota, provinsi, kode_pos)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'no_hp', ''),
    COALESCE(NEW.raw_user_meta_data->>'alamat', ''),
    COALESCE(NEW.raw_user_meta_data->>'kota', ''),
    COALESCE(NEW.raw_user_meta_data->>'provinsi', ''),
    COALESCE(NEW.raw_user_meta_data->>'kode_pos', '')
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO _is_first;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN _is_first THEN 'admin'::public.app_role ELSE 'customer'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
