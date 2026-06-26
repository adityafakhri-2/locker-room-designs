import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });

    // Verifikasi apakah profil pengguna sudah lengkap
    const { data: profile } = await supabase
      .from("profiles")
      .select("no_hp, alamat")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.no_hp || !profile.alamat) {
      // Jika belum lengkap, paksa kembali ke /auth untuk melengkapi profil
      throw redirect({ to: "/auth" });
    }

    // Jika user adalah admin dan mencoba mengakses rute pelanggan (/dashboard/*), redirect ke /admin
    if (location.pathname.startsWith("/dashboard")) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (roleData) {
        throw redirect({ to: "/admin" });
      }
    }

    return { userId: data.user.id };
  },
  component: () => (
    <>
      <Navbar />
      <Outlet />
    </>
  ),
});
