import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle2, ShieldCheck, KeyRound, Mail, User } from "lucide-react";
import { IndonesiaRegionSelector } from "@/components/app/IndonesiaRegionSelector";
import { parseAlamat } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/admin/profil")({
  component: AdminProfilePage,
});

function AdminProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

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

  // Password update states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

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

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const finalAlamat =
      alamatDetail +
      (kecamatan ? `, Kec. ${kecamatan}` : "") +
      (kelurahan ? `, Kel. ${kelurahan}` : "");

    const updatedPayload = {
      ...form,
      alamat: finalAlamat,
    };

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

    if (!data || data.length === 0) {
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, ...updatedPayload }, { onConflict: "id" });

      if (upsertError) {
        console.error("Upsert fallback failed:", upsertError);
        setSaving(false);
        return toast.error("Gagal menyimpan profil: " + upsertError.message);
      }
    }

    setSaving(false);
    setIsEditing(false);
    toast.success("Profil admin berhasil disimpan!");
    qc.invalidateQueries({ queryKey: ["profile"] });
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

      toast.success("Password admin berhasil diperbarui!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui password: " + (err as Error).message);
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) {
      return toast.error("Email admin tidak ditemukan!");
    }

    setSendingResetEmail(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth?mode=reset-password`,
      });

      if (error) {
        if (
          error.status === 429 ||
          error.message.toLowerCase().includes("rate limit") ||
          error.message.toLowerCase().includes("too many requests")
        ) {
          return toast.error(
            "Terlalu banyak permintaan reset password (Rate Limit). Silakan coba lagi beberapa saat.",
          );
        }
        throw error;
      }

      toast.success(`Tautan reset password berhasil dikirim ke ${user.email}!`);
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengirim email reset: " + (err as Error).message);
    } finally {
      setSendingResetEmail(false);
    }
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

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Akun"
        title="Profil & Keamanan Admin"
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Kolom 1 & 2: Informasi Profil Admin */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="flex items-center gap-2.5 mb-6 border-b border-border pb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <User className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Informasi Profil Admin</h2>
                <p className="text-xs text-muted-foreground">
                  Kelola data identitas dan kontak akun administrator.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="admin-name">Nama Lengkap</Label>
                <Input
                  id="admin-name"
                  disabled={!isEditing}
                  value={form.nama_lengkap}
                  onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                  placeholder="Nama Administrator"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="admin-email">Email Akun</Label>
                <Input
                  id="admin-email"
                  value={user?.email ?? ""}
                  disabled
                  className="mt-1 bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Email digunakan untuk login dan pemulihan akun.
                </p>
              </div>

              <div>
                <Label htmlFor="admin-phone">Nomor HP / WhatsApp</Label>
                <Input
                  id="admin-phone"
                  disabled={!isEditing}
                  value={form.no_hp}
                  onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                  placeholder="Contoh: 081234567890"
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
                <h3 className="font-semibold text-sm mb-3">Alamat / Wilayah</h3>
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
                required={false}
              />

              <div className="sm:col-span-2 mt-4">
                {!isEditing ? (
                  <Button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="cursor-pointer"
                  >
                    Edit Profil
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button type="submit" disabled={saving} className="cursor-pointer">
                      {saving ? "Menyimpan..." : "Simpan Profil"}
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

        {/* Kolom 3: Pengaturan Password & Keamanan */}
        <div className="space-y-6">
          {/* Card Ganti Password Manual */}
          <Card>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <KeyRound className="size-4" />
              </div>
              <div>
                <h3 className="text-base font-bold">Ganti Password</h3>
                <p className="text-xs text-muted-foreground">
                  Perbarui kata sandi akun admin Anda secara langsung.
                </p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5 mt-4">
              <div>
                <Label htmlFor="admin-new-password">Password Baru</Label>
                <div className="relative mt-1">
                  <Input
                    id="admin-new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="pr-10"
                    minLength={6}
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="admin-confirm-password">Konfirmasi Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="admin-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                    className="pr-10"
                    minLength={6}
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={updatingPassword || !newPassword}
                className="w-full cursor-pointer mt-2"
              >
                {updatingPassword ? "Menyimpan Password..." : "Perbarui Password"}
              </Button>
            </form>

            {/* Opsi Kirim Email Reset Password */}
            <div className="mt-6 pt-5 border-t border-border space-y-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                Lupa Password / Kirim Tautan Reset
              </Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Ingin mengatur ulang kata sandi melalui email? Klik tombol di bawah untuk menerima tautan pemulihan.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={handleSendResetEmail}
                disabled={sendingResetEmail}
                className="w-full text-xs cursor-pointer mt-1"
              >
                {sendingResetEmail ? "Mengirim Email..." : "Kirim Tautan Reset ke Email"}
              </Button>
            </div>
          </Card>

          {/* Card Koneksi Sosial Google */}
          <Card>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <h3 className="text-base font-bold">Koneksi Akun Google</h3>
                <p className="text-xs text-muted-foreground">
                  Login cepat ke panel admin menggunakan akun Google.
                </p>
              </div>
            </div>

            <div className="mt-4">
              {isGoogleConnected ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-3 rounded-lg text-sm font-semibold">
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Akun Google Terhubung</span>
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
            </div>
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
