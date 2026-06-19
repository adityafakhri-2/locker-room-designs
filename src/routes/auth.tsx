import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/landing/Navbar";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login / Daftar — The Locker Room" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [kota, setKota] = useState("");
  const [provinsi, setProvinsi] = useState("");
  const [kodePos, setKodePos] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc("has_registered_users").then(({ data, error }) => {
      if (!error && typeof data === "boolean") {
        setHasUsers(data);
      } else {
        setHasUsers(false);
      }
    });
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return toast.error(
          "Email belum terkonfirmasi! Silakan cek kotak masuk email Anda untuk melakukan verifikasi, atau nonaktifkan 'Confirm email' di Dashboard Supabase -> Auth -> Providers -> Email jika sedang masa pengembangan."
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

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Konfirmasi password tidak cocok dengan password!");
    }
    if (!namaLengkap || !noHp || !alamat || !kota || !provinsi || !kodePos) {
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
          alamat: alamat,
          kota: kota,
          provinsi: provinsi,
          kode_pos: kodePos
        }
      },
    });
    
    if (error) {
      setLoading(false);
      if (error.status === 429 || error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("too many requests")) {
        return toast.error(
          "Batas pengiriman email pendaftaran terlampaui (Rate Limit 429). Silakan tunggu beberapa menit, atau konfirmasi email pengguna secara manual di Dashboard Supabase (Auth -> Users -> Klik User -> Confirm User)."
        );
      }
      return toast.error(error.message);
    }

    if (data?.session) {
      // Update profile with additional address details if session is active immediately
      await supabase.from("profiles").update({
        no_hp: noHp,
        alamat: alamat,
        kota: kota,
        provinsi: provinsi,
        kode_pos: kodePos
      }).eq("id", data.session.user.id);

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
      toast.success("Registrasi berhasil! Silakan cek kotak masuk email Anda untuk melakukan verifikasi akun.");
    }
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-20 md:pt-24 bg-muted/30 grid place-items-center px-5 py-12">
        <div className="w-full max-w-md bg-background border border-border p-8 md:p-10">
          <Link to="/" className="eyebrow text-muted-foreground">← Kembali ke beranda</Link>
          <h1 className="display-md mt-4">The Locker Room</h1>
          <p className="text-sm text-muted-foreground mt-2">Where Football Memories Live.</p>

          <Tabs defaultValue="login" className="mt-8">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Masuk</TabsTrigger>
              <TabsTrigger value="register">Daftar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={login} className="space-y-4">
                <div>
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" placeholder="contoh@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lp">Password</Label>
                  <div className="relative">
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
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Memproses..." : "Masuk"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              {/* Step progress indicator */}
              <div className="flex items-center justify-between mb-5 text-[11px] font-bold text-muted-foreground border-b border-border/40 pb-3">
                <span className={step === 1 ? "text-primary font-extrabold" : ""}>1. BUAT AKUN</span>
                <div className="flex-1 border-t border-dashed border-border/60 mx-3" />
                <span className={step === 2 ? "text-primary font-extrabold" : ""}>2. LENGKAPI PROFIL</span>
              </div>

              <form onSubmit={register} className="space-y-4">
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="re">Email</Label>
                      <Input id="re" type="email" placeholder="contoh@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
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
                      <Input id="rn" placeholder="Nama Lengkap Anda" required value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="rphone">Nomor HP</Label>
                      <Input id="rphone" placeholder="Contoh: 08123456789" required value={noHp} onChange={(e) => setNoHp(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="radr">Alamat Lengkap</Label>
                      <Input id="radr" placeholder="Nama jalan, RT/RW, No. Rumah" required value={alamat} onChange={(e) => setAlamat(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="rcity">Kota/Kabupaten</Label>
                        <Input id="rcity" placeholder="Kota" required value={kota} onChange={(e) => setKota(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="rprov">Provinsi</Label>
                        <Input id="rprov" placeholder="Provinsi" required value={provinsi} onChange={(e) => setProvinsi(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="rzip">Kode Pos</Label>
                      <Input id="rzip" placeholder="Kode Pos" required value={kodePos} onChange={(e) => setKodePos(e.target.value)} />
                    </div>

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
                      <p className="text-xs text-muted-foreground text-center">Pengguna pertama yang mendaftar otomatis menjadi admin.</p>
                    )}
                  </div>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
