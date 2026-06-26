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
import { IndonesiaRegionSelector } from "@/components/app/IndonesiaRegionSelector";
import { parseAlamat } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/admin/pengaturan")({
  component: AdminStoreSettings,
});

function AdminStoreSettings() {
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
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["store-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching admin profile:", error);
        toast.error("Gagal mengambil pengaturan toko: " + error.message);
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
      console.error("Error updating store settings:", error);
      setSaving(false);
      return toast.error("Gagal menyimpan pengaturan: " + error.message);
    }

    if (!data || data.length === 0) {
      // Fallback ke upsert jika update 0 baris
      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert({ id: user!.id, ...updatedPayload }, { onConflict: "id" });

      if (upsertError) {
        console.error("Upsert fallback failed:", upsertError);
        setSaving(false);
        return toast.error("Gagal menyimpan pengaturan: " + upsertError.message);
      }
    }

    setSaving(false);
    setIsEditing(false);
    toast.success("Pengaturan toko berhasil diperbarui!");
    qc.invalidateQueries({ queryKey: ["store-profile"] });
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Pengaturan" title="Pengaturan Toko" />
      <Card>
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground mb-6">
            Konfigurasi informasi toko dan alamat asal pengiriman Anda. Alamat ini akan digunakan
            secara otomatis sebagai titik asal (origin) untuk menghitung tarif pengiriman RajaOngkir
            ke pelanggan.
          </p>
          <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Nama Toko / Pemilik</Label>
              <Input
                required
                disabled={!isEditing}
                value={form.nama_lengkap}
                onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                placeholder="Contoh: The Locker Room"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Nomor WhatsApp / HP Toko</Label>
              <Input
                required
                disabled={!isEditing}
                value={form.no_hp}
                onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                placeholder="Contoh: 081234567890"
              />
            </div>

            <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
              <h3 className="font-semibold text-sm mb-4">Alamat Asal Pengiriman</h3>
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

            <div className="sm:col-span-2 mt-6">
              {!isEditing ? (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full sm:w-auto cursor-pointer"
                >
                  Edit Toko
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    {saving ? "Menyimpan..." : "Simpan Pengaturan"}
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
                    className="w-full sm:w-auto cursor-pointer"
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>
          </form>
        </div>
      </Card>
    </DashboardShell>
  );
}
