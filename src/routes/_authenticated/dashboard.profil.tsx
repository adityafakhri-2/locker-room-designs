import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "./dashboard.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/dashboard/profil")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ nama_lengkap: "", no_hp: "", alamat: "", kota: "", provinsi: "", kode_pos: "" });
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (q.data) setForm({
      nama_lengkap: q.data.nama_lengkap ?? "", no_hp: q.data.no_hp ?? "",
      alamat: q.data.alamat ?? "", kota: q.data.kota ?? "",
      provinsi: q.data.provinsi ?? "", kode_pos: q.data.kode_pos ?? "",
    });
  }, [q.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profil disimpan");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader eyebrow="Profil" title="Data Pribadi" action={<Button variant="outline" onClick={logout}>Logout</Button>} />
      <Card>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="sm:col-span-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
          <div className="sm:col-span-2"><Label>Nama Lengkap</Label><Input value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} /></div>
          <div><Label>Nomor HP</Label><Input value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} /></div>
          <div><Label>Kode Pos</Label><Input value={form.kode_pos} onChange={(e) => setForm({ ...form, kode_pos: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Alamat</Label><Textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} /></div>
          <div><Label>Kota</Label><Input value={form.kota} onChange={(e) => setForm({ ...form, kota: e.target.value })} /></div>
          <div><Label>Provinsi</Label><Input value={form.provinsi} onChange={(e) => setForm({ ...form, provinsi: e.target.value })} /></div>
          <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button></div>
        </form>
      </Card>
    </DashboardShell>
  );
}
