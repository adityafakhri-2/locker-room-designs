import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/landing/Navbar";
import { Eye, EyeOff, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { IndonesiaRegionSelector } from "@/components/app/IndonesiaRegionSelector";
import { parseAlamat } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Login / Daftar — AA Jersey" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [alamatDetail, setAlamatDetail] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [kelurahan, setKelurahan] = useState("");
  const [kota, setKota] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [kodePos, setKodePos] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  // Reset / Recovery Password States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  useEffect(() => {
    supabase.rpc("has_registered_users").then(({ data, error }) => {
      if (!error && typeof data === "boolean") {
        setHasUsers(data);
      } else {
        setHasUsers(false);
      }
    });
  }, []);

  // Check URL query or hash for password recovery state
  useEffect(() => {
    const hash = window.location.hash;
    const search = window.location.search;
    if (
      hash.includes("type=recovery") ||
      search.includes("type=recovery") ||
      search.includes("mode=reset-password")
    ) {
      setIsRecoveryMode(true);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading || isRecoveryMode) return;

    if (user) {
      setProfileLoading(true);
      supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          setProfileLoading(false);
          if (error) {
            toast.error("Gagal memuat profil: " + error.message);
            return;
          }

          // Jika data profil belum lengkap (misalnya no_hp atau alamat kosong)
          if (!data || !data.no_hp || !data.alamat) {
            setIsProfileIncomplete(true);
            if (data?.nama_lengkap) {
              setNamaLengkap(data.nama_lengkap);
            } else if (user.user_metadata?.full_name) {
              setNamaLengkap(user.user_metadata.full_name);
            }
            if (data) {
              const parsed = parseAlamat(data.alamat ?? "");
              setNoHp(data.no_hp ?? "");
              setAlamat(data.alamat ?? "");
              setAlamatDetail(parsed.street);
              setKecamatan(parsed.kecamatan);
              setKelurahan(parsed.kelurahan);
              setKota(data.kota ?? "");
              setProvinsi(data.provinsi ?? "");
              setKodePos(data.kode_pos ?? "");
            }
          } else {
            // Profil lengkap, arahkan ke dashboard atau admin
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .eq("role", "admin")
              .maybeSingle()
              .then(({ data: roleData }) => {
                if (roleData) {
                  navigate({ to: "/admin" });
                } else {
                  navigate({ to: "/dashboard" });
                }
              });
          }
        });
    } else {
      setIsProfileIncomplete(false);
    }
  }, [user, authLoading, isRecoveryMode, navigate]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return toast.error(
          "Email belum terkonfirmasi! Silakan cek kotak masuk email Anda untuk melakukan verifikasi, atau nonaktifkan 'Confirm email' di Dashboard Supabase -> Auth -> Providers -> Email jika sedang masa pengembangan.",
        );
      }
      return toast.error(error.message);
    }

    if (data?.user) {
      // Check user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      toast.success("Berhasil masuk");
      if (roleData) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/dashboard" });
      }
    }
  }

  async function handleRequestPasswordReset(e: React.FormEvent) {
    if (e) e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      return toast.error("Silakan masukkan email Anda terlebih dahulu!");
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/auth?mode=reset-password`,
    });
    setResetLoading(false);

    if (error) {
      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("too many requests")
      ) {
        return toast.error(
          "Terlalu banyak permintaan reset password (Rate Limit). Silakan tunggu beberapa saat lagi.",
        );
      }
      return toast.error("Gagal mengirim email reset: " + error.message);
    }

    setResetSent(true);
    toast.success("Tautan reset password berhasil dikirim ke email Anda!");
  }

  async function handleResetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) {
      return toast.error("Password baru tidak boleh kosong!");
    }
    if (newPassword.length < 6) {
      return toast.error("Password minimal 6 karakter!");
    }
    if (newPassword !== confirmNewPassword) {
      return toast.error("Konfirmasi password tidak cocok!");
    }

    setResetLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setResetLoading(false);

    if (error) {
      return toast.error("Gagal mengubah password: " + error.message);
    }

    toast.success("Password berhasil diperbarui!");
    setIsRecoveryMode(false);
    setShowForgotPassword(false);
    setNewPassword("");
    setConfirmNewPassword("");

    // Check user role to navigate
    if (user) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } else {
      navigate({ to: "/auth" });
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok dengan password!");
    }

    const finalAlamat =
      alamatDetail +
      (kecamatan ? `, Kec. ${kecamatan}` : "") +
      (kelurahan ? `, Kel. ${kelurahan}` : "");

    if (!namaLengkap || !noHp || !alamatDetail || !kota || !provinsi || !kodePos) {
      return toast.error("Semua field profil wajib diisi!");
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nama_lengkap: namaLengkap,
          no_hp: noHp,
          alamat: finalAlamat,
          kota: kota,
          provinsi: provinsi,
          kode_pos: kodePos,
        },
      },
    });

    if (error) {
      setLoading(false);
      if (
        error.status === 429 ||
        error.message.toLowerCase().includes("rate limit") ||
        error.message.toLowerCase().includes("too many requests")
      ) {
        return toast.error(
          "Batas pengiriman email pendaftaran terlampaui (Rate Limit 429). Silakan tunggu beberapa menit, atau konfirmasi email pengguna secara manual di Dashboard Supabase (Auth -> Users -> Klik User -> Confirm User).",
        );
      }
      return toast.error(error.message);
    }

    if (data?.session) {
      // Update profile with additional address details if session is active immediately
      await supabase
        .from("profiles")
        .update({
          no_hp: noHp,
          alamat: finalAlamat,
          kota: kota,
          provinsi: provinsi,
          kode_pos: kodePos,
        })
        .eq("id", data.session.user.id);

      // Check user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      setLoading(false);
      toast.success("Registrasi berhasil, masuk ke dashboard...");
      if (roleData) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } else {
      setLoading(false);
      toast.success(
        "Registrasi berhasil! Silakan cek kotak masuk email Anda untuk melakukan verifikasi akun.",
      );
    }
  }

  async function loginWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
    }
  }

  async function completeProfile(e: React.FormEvent) {
    e.preventDefault();

    const finalAlamat =
      alamatDetail +
      (kecamatan ? `, Kec. ${kecamatan}` : "") +
      (kelurahan ? `, Kel. ${kelurahan}` : "");

    if (!namaLengkap || !noHp || !alamatDetail || !kota || !provinsi || !kodePos) {
      return toast.error("Semua field profil wajib diisi!");
    }
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        nama_lengkap: namaLengkap,
        no_hp: noHp,
        alamat: finalAlamat,
        kota: kota,
        provinsi: provinsi,
        kode_pos: kodePos,
      })
      .eq("id", user!.id);

    if (error) {
      setLoading(false);
      return toast.error("Gagal menyimpan profil: " + error.message);
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .maybeSingle();

    setLoading(false);
    toast.success("Profil berhasil dilengkapi!");

    if (roleData) {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  if (authLoading || (user && profileLoading && !isRecoveryMode)) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-20 md:pt-24 bg-muted/30 grid place-items-center px-5 py-12">
          <div className="w-full max-w-md bg-background border border-border p-8 md:p-10 text-center">
            <p className="text-muted-foreground animate-pulse">Memproses autentikasi...</p>
          </div>
        </div>
      </>
    );
  }

  // Recovery Mode View: User opened password reset link from email
  if (isRecoveryMode) {
    return (
      <>
        <Navbar />
        <main
          id="main-content"
          className="min-h-screen pt-20 md:pt-24 bg-muted/30 grid place-items-center px-5 py-12"
        >
          <div className="w-full max-w-lg bg-background border border-border p-8 md:p-10 shadow-sm">
            <div className="inline-flex p-2.5 bg-primary/10 text-primary rounded-xl mb-4">
              <KeyRound className="size-5" />
            </div>
            <h1 className="display-md">Atur Password Baru</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Silakan buat kata sandi baru untuk mengamankan akun Anda.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 mt-6">
              <div>
                <Label htmlFor="new-password">Password Baru</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-new-password">Konfirmasi Password Baru</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirm-new-password"
                    type={showConfirmNewPassword ? "text" : "password"}
                    placeholder="Ulangi password baru Anda"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmNewPassword ? "Sembunyikan password" : "Tampilkan password"}
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded"
                  >
                    {showConfirmNewPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={resetLoading} className="w-full cursor-pointer mt-2">
                {resetLoading ? "Menyimpan Password..." : "Simpan Password Baru"}
              </Button>
            </form>
          </div>
        </main>
      </>
    );
  }

  if (isProfileIncomplete) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-20 md:pt-24 bg-muted/30 grid place-items-center px-5 py-12">
          <div className="w-full max-w-xl md:max-w-2xl bg-background border border-border p-8 md:p-10 shadow-sm">
            <h1 className="display-md">Lengkapi Profil</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Silakan lengkapi data profil Anda untuk melanjutkan transaksi dan mengakses dashboard.
            </p>

            <form onSubmit={completeProfile} className="space-y-4 mt-6">
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <Label htmlFor="rn">Nama Lengkap</Label>
                  <Input
                    id="rn"
                    placeholder="Nama Lengkap Anda"
                    required
                    value={namaLengkap}
                    onChange={(e) => setNamaLengkap(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="rphone">Nomor HP</Label>
                  <Input
                    id="rphone"
                    placeholder="Contoh: 08123456789"
                    required
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                  />
                </div>
                <IndonesiaRegionSelector
                  provinsi={provinsi}
                  setProvinsi={setProvinsi}
                  kota={kota}
                  setKota={setKota}
                  kecamatan={kecamatan}
                  setKecamatan={setKecamatan}
                  kelurahan={kelurahan}
                  setKelurahan={setKelurahan}
                  kodePos={kodePos}
                  setKodePos={setKodePos}
                  alamatDetail={alamatDetail}
                  setAlamatDetail={setAlamatDetail}
                  required={true}
                />

                <div className="pt-2">
                  <Button type="submit" disabled={loading} className="w-full cursor-pointer">
                    {loading ? "Menyimpan..." : "Simpan & Lanjutkan"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main
        id="main-content"
        className="min-h-screen pt-20 md:pt-24 bg-muted/30 grid place-items-center px-5 py-12"
      >
        <div className="w-full max-w-xl md:max-w-2xl bg-background border border-border p-8 md:p-10 shadow-sm">
          <Link to="/" className="eyebrow text-muted-foreground">
            ← Kembali ke beranda
          </Link>
          <h1 className="display-md mt-4">AA Jersey</h1>
          <p className="text-sm text-muted-foreground mt-2">Jersey Asli, Gaya Sejati.</p>

          {showForgotPassword ? (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetSent(false);
                }}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-4 transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                Kembali ke formulir login
              </button>

              <div className="space-y-1 mb-6">
                {/* <div className="inline-flex p-2 bg-primary/10 text-primary rounded-lg mb-2">
                  <Mail className="size-4" />
                </div> */}
                <h2 className="text-xl font-bold tracking-tight">Reset Password</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Masukkan email yang terdaftar pada akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-md text-sm text-foreground space-y-2">
                    <p className="font-semibold text-primary">Tautan telah dikirim!</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Kami telah mengirimkan tautan instruksi reset password ke{" "}
                      <span className="font-medium text-foreground">{resetEmail || email}</span>. Silakan periksa kotak masuk atau folder spam email Anda.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRequestPasswordReset}
                      disabled={resetLoading}
                      className="w-full text-xs cursor-pointer"
                    >
                      {resetLoading ? "Mengirim ulang..." : "Kirim Ulang Email"}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false);
                        setResetSent(false);
                      }}
                      className="w-full cursor-pointer"
                    >
                      Kembali ke Login
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRequestPasswordReset} className="space-y-4">
                  <div>
                    <Label htmlFor="reset-email">Email Akun</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="contoh@email.com"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <Button type="submit" disabled={resetLoading} className="w-full cursor-pointer">
                    {resetLoading ? "Mengirim Tautan..." : "Kirim Link Reset Password"}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <>
              <Tabs defaultValue="login" className="mt-8">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Masuk</TabsTrigger>
                  <TabsTrigger value="register">Daftar</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={login} className="space-y-4">
                    <div>
                      <Label htmlFor="le">Email</Label>
                      <Input
                        id="le"
                        type="email"
                        placeholder="contoh@email.com"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setResetEmail(e.target.value);
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="lp">Password</Label>
                        <button
                          type="button"
                          onClick={() => {
                            setResetEmail(email);
                            setShowForgotPassword(true);
                          }}
                          className="text-xs text-primary hover:underline font-medium cursor-pointer transition-colors"
                        >
                          Lupa password?
                        </button>
                      </div>
                      <div className="relative mt-1.5">
                        <Input
                          id="lp"
                          type={showPassword ? "text" : "password"}
                          placeholder="Masukkan password Anda"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full">
                      {loading ? "Memproses..." : "Masuk"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register" className="mt-6">
                  {/* Step progress indicator */}
                  <div className="flex items-center justify-between mb-5 text-[11px] font-bold text-muted-foreground border-b border-border/40 pb-3">
                    <span className={step === 1 ? "text-primary font-extrabold" : ""}>
                      1. BUAT AKUN
                    </span>
                    <div className="flex-1 border-t border-dashed border-border/60 mx-3" />
                    <span className={step === 2 ? "text-primary font-extrabold" : ""}>
                      2. LENGKAPI PROFIL
                    </span>
                  </div>

                  <form onSubmit={register} className="space-y-4">
                    {step === 1 && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="re">Email</Label>
                          <Input
                            id="re"
                            type="email"
                            placeholder="contoh@email.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="rp">Password</Label>
                          <div className="relative">
                            <Input
                              id="rp"
                              type={showPassword ? "text" : "password"}
                              placeholder="Minimal 6 karakter"
                              required
                              minLength={6}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary outline-none rounded"
                            >
                              {showPassword ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="rcp">Konfirmasi Password</Label>
                          <div className="relative">
                            <Input
                              id="rcp"
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Ulangi password Anda"
                              required
                              minLength={6}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            if (!email || !password || !confirmPassword) {
                              return toast.error("Semua field akun wajib diisi!");
                            }
                            if (password !== confirmPassword) {
                              return toast.error("Konfirmasi password tidak cocok!");
                            }
                            if (password.length < 6) {
                              return toast.error("Password minimal 6 karakter!");
                            }
                            setStep(2);
                          }}
                          className="w-full cursor-pointer mt-2"
                        >
                          Lanjut ke Data Profil
                        </Button>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div>
                          <Label htmlFor="rn">Nama Lengkap</Label>
                          <Input
                            id="rn"
                            placeholder="Nama Lengkap Anda"
                            required
                            value={namaLengkap}
                            onChange={(e) => setNamaLengkap(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="rphone">Nomor HP</Label>
                          <Input
                            id="rphone"
                            placeholder="Contoh: 08123456789"
                            required
                            value={noHp}
                            onChange={(e) => setNoHp(e.target.value)}
                          />
                        </div>
                        <IndonesiaRegionSelector
                          provinsi={provinsi}
                          setProvinsi={setProvinsi}
                          kota={kota}
                          setKota={setKota}
                          kecamatan={kecamatan}
                          setKecamatan={setKecamatan}
                          kelurahan={kelurahan}
                          setKelurahan={setKelurahan}
                          kodePos={kodePos}
                          setKodePos={setKodePos}
                          alamatDetail={alamatDetail}
                          setAlamatDetail={setAlamatDetail}
                          required={true}
                        />

                        <div className="flex gap-3 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setStep(1)}
                            className="flex-1 cursor-pointer"
                          >
                            Kembali
                          </Button>
                          <Button type="submit" disabled={loading} className="flex-1 cursor-pointer">
                            {loading ? "Memproses..." : "Daftar"}
                          </Button>
                        </div>
                        {hasUsers === false && (
                          <p className="text-xs text-muted-foreground text-center">
                            Pengguna pertama yang mendaftar otomatis menjadi admin.
                          </p>
                        )}
                      </div>
                    )}
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Atau masuk dengan</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center justify-center gap-2 cursor-pointer"
                onClick={loginWithGoogle}
                disabled={loading}
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Google
              </Button>
            </>
          )}
        </div>
      </main>
    </>
  );
}

