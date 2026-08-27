import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2 } from "lucide-react";
import { triggerGlobalLogout } from "@/components/common/LogoutOverlay";

import { IndonesiaRegionSelector } from "@/components/app/IndonesiaRegionSelector";
import { parseAlamat } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/profil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nama_lengkap: "",
    no_hp: "",
    alamat: "",
    kota: "",
    provinsi: "",
    kode_pos: "",
  });
  const [alamatDetail, setAlamatDetail] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [kelurahan, setKelurahan] = useState("");
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const authUserQuery = useQuery({
    queryKey: ["auth-user", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });

  const authUser = authUserQuery.data;
  const isGoogleConnected = authUser?.identities?.some((id) => id.provider === "google") ?? false;

  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Gagal mengambil profil: " + error.message);
      }
      return data;
    },
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    if (q.data) {
      const parsed = parseAlamat(q.data.alamat ?? "");
      setForm({
        nama_lengkap: q.data.nama_lengkap ?? "",
        no_hp: q.data.no_hp ?? "",
        alamat: q.data.alamat ?? "",
        kota: q.data.kota ?? "",
        provinsi: q.data.provinsi ?? "",
        kode_pos: q.data.kode_pos ?? "",
      });
      setAlamatDetail(parsed.street);
      setKecamatan(parsed.kecamatan);
      setKelurahan(parsed.kelurahan);
    }
  }, [q.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    // Combine detail, district (kecamatan), and village (kelurahan)
    const finalAlamat =
      alamatDetail +
      (kecamatan ? `, Kec. ${kecamatan}` : "") +
      (kelurahan ? `, Kel. ${kelurahan}` : "");

    const updatedPayload = {
      ...form,
      alamat: finalAlamat,
    };

    // 1. Try updating first
    const { data, error } = await supabase
      .from("profiles")
      .update(updatedPayload)
      .eq("id", user!.id)
      .select();

    if (error) {
      console.error("Error updating profile:", error);
      setSaving(false);
      return toast.error("Gagal menyimpan profil: " + error.message);
    }

    // 2. Fall back to upsert if update modified 0 rows (missing row or RLS filter)
    if (!data || data.length === 0) {
      const { data: upsertData, error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, ...updatedPayload }, { onConflict: "id" })
        .select();

      setSaving(false);

      if (upsertError) {
        console.error("Upsert fallback failed:", upsertError);
        return toast.error("Gagal menyimpan profil: " + upsertError.message);
      }

      if (!upsertData || upsertData.length === 0) {
        console.error("Both update and upsert returned empty results (RLS policy block)");
        return toast.error(
          "Gagal menyimpan profil: Akses ditolak oleh aturan database (RLS Policy)",
        );
      }
    } else {
      setSaving(false);
    }

    toast.success("Profil disimpan");
    setIsEditing(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function logout() {
    triggerGlobalLogout();
  }

  async function handleLinkGoogle() {
    try {
      const redirectUrl = window.location.href;
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghubungkan ke Google: " + (err as Error).message);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) {
      return toast.error("Password baru tidak boleh kosong.");
    }
    if (newPassword.length < 6) {
      return toast.error("Password minimal terdiri dari 6 karakter.");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok.");
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password manual berhasil ditambahkan/diubah!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui password: " + (err as Error).message);
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader
        eyebrow="Profil"
        title="Data Pribadi"
        action={
          <Button variant="outline" onClick={logout} className="cursor-pointer">
            Logout
          </Button>
        }
      />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="profile-name">Nama Lengkap</Label>
                <Input
                  id="profile-name"
                  disabled={!isEditing}
                  value={form.nama_lengkap}
                  onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user?.email ?? ""} disabled />
              </div>
              <div>
                <Label htmlFor="profile-phone">Nomor HP</Label>
                <Input
                  id="profile-phone"
                  disabled={!isEditing}
                  value={form.no_hp}
                  onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                />
              </div>

              <IndonesiaRegionSelector
                disabled={!isEditing}
                provinsi={form.provinsi}
                setProvinsi={(val) => setForm((f) => ({ ...f, provinsi: val }))}
                kota={form.kota}
                setKota={(val) => setForm((f) => ({ ...f, kota: val }))}
                kecamatan={kecamatan}
                setKecamatan={setKecamatan}
                kelurahan={kelurahan}
                setKelurahan={setKelurahan}
                kodePos={form.kode_pos}
                setKodePos={(val) => setForm((f) => ({ ...f, kode_pos: val }))}
                alamatDetail={alamatDetail}
                setAlamatDetail={setAlamatDetail}
                required={true}
              />
              <div className="sm:col-span-2 mt-2">
                {!isEditing ? (
                  <Button type="button" onClick={() => setIsEditing(true)} className="cursor-pointer">
                    Edit Profil
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button type="submit" disabled={saving} className="cursor-pointer">
                      {saving ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (q.data) {
                          const parsed = parseAlamat(q.data.alamat ?? "");
                          setForm({
                            nama_lengkap: q.data.nama_lengkap ?? "",
                            no_hp: q.data.no_hp ?? "",
                            alamat: q.data.alamat ?? "",
                            kota: q.data.kota ?? "",
                            provinsi: q.data.provinsi ?? "",
                            kode_pos: q.data.kode_pos ?? "",
                          });
                          setAlamatDetail(parsed.street);
                          setKecamatan(parsed.kecamatan);
                          setKelurahan(parsed.kelurahan);
                        } else {
                          setForm({
                            nama_lengkap: "",
                            no_hp: "",
                            alamat: "",
                            kota: "",
                            provinsi: "",
                            kode_pos: "",
                          });
                          setAlamatDetail("");
                          setKecamatan("");
                          setKelurahan("");
                        }
                        setIsEditing(false);
                      }}
                      className="cursor-pointer"
                    >
                      Batal
                    </Button>
                  </div>
                )}
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-base font-bold mb-2">Koneksi Sosial</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Hubungkan akun Anda dengan Google agar dapat login dengan satu kali klik.
            </p>
            {isGoogleConnected ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-3 rounded-lg text-sm font-semibold">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Terhubung ke Google</span>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleLinkGoogle}
                className="w-full justify-center text-sm font-semibold cursor-pointer h-10 border-border"
              >
                <GoogleIcon />
                Hubungkan ke Google
              </Button>
            )}
          </Card>

          <Card>
            <h3 className="text-base font-bold mb-2">Password Manual</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Atur password manual agar Anda juga dapat login menggunakan email dan password secara langsung.
            </p>
            <form onSubmit={handleUpdatePassword} className="space-y-3">
              <div>
                <Label htmlFor="new-password">Password Baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="h-10"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password">Konfirmasi Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password"
                  className="h-10"
                />
              </div>
              <Button
                type="submit"
                disabled={updatingPassword}
                className="w-full cursor-pointer h-10 font-semibold mt-2"
              >
                {updatingPassword ? "Menyimpan..." : "Simpan Password"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}

const GoogleIcon = () => (
  <svg className="size-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
);
