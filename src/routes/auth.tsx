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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");
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
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { nama_lengkap: namaLengkap } },
    });
    setLoading(false);
    
    if (error) {
      if (error.status === 429 || error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("too many requests")) {
        return toast.error(
          "Batas pengiriman email pendaftaran terlampaui (Rate Limit 429). Silakan tunggu beberapa menit, atau konfirmasi email pengguna secara manual di Dashboard Supabase (Auth -> Users -> Klik User -> Confirm User)."
        );
      }
      return toast.error(error.message);
    }

    if (data?.session) {
      // Check user role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      toast.success("Registrasi berhasil, masuk ke dashboard...");
      if (roleData) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } else {
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
              <form onSubmit={register} className="space-y-4">
                <div>
                  <Label htmlFor="rn">Nama Lengkap</Label>
                  <Input id="rn" placeholder="Nama Lengkap Anda" required value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} />
                </div>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Memproses..." : "Daftar"}</Button>
                {hasUsers === false && (
                  <p className="text-xs text-muted-foreground">Pengguna pertama yang mendaftar otomatis menjadi admin.</p>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
