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

import { IndonesiaRegionSelector, parseAlamat } from "@/components/app/IndonesiaRegionSelector";

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
    console.log("Profile query data fetched:", q.data);
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

    console.log("Attempting to update profile payload:", updatedPayload);

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
      console.log("No rows updated. Profile row might not exist. Attempting upsert fallback...");
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

      console.log("Upsert fallback success response:", upsertData);
    } else {
      setSaving(false);
      console.log("Update success response:", data);
    }

    toast.success("Profil disimpan");
    setIsEditing(false);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
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
      <Card>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div className="sm:col-span-2">
            <Label>Nama Lengkap</Label>
            <Input
              disabled={!isEditing}
              value={form.nama_lengkap}
              onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div>
            <Label>Nomor HP</Label>
            <Input
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
    </DashboardShell>
  );
}
