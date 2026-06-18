import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/landing/Navbar";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login / Daftar — The Locker Room" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [namaLengkap, setNamaLengkap] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Berhasil masuk");
    navigate({ to: "/dashboard" });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { nama_lengkap: namaLengkap } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Akun berhasil dibuat. Silakan login.");
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
                <div><Label htmlFor="le">Email</Label><Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="lp">Password</Label><Input id="lp" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Memproses..." : "Masuk"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <form onSubmit={register} className="space-y-4">
                <div><Label htmlFor="rn">Nama Lengkap</Label><Input id="rn" required value={namaLengkap} onChange={(e) => setNamaLengkap(e.target.value)} /></div>
                <div><Label htmlFor="re">Email</Label><Input id="re" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><Label htmlFor="rp">Password</Label><Input id="rp" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Memproses..." : "Daftar"}</Button>
                <p className="text-xs text-muted-foreground">Pengguna pertama yang mendaftar otomatis menjadi admin.</p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}
