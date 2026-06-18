import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadFile, signedUrl } from "@/lib/storage";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";

interface PFormState {
  slug: string; name: string; price: string; stock: string; category_id: string;
  brand: string; team: string; league: string; country: string; release_year: string;
  condition: string; sizes: string; description: string; story: string;
  collector_score: string; authenticity_badge: string; video_url: string; is_active: boolean;
}

function formatThousand(val: string | number): string {
  const numStr = String(val).replace(/\D/g, "");
  if (!numStr) return "";
  return Number(numStr).toLocaleString("id-ID");
}

const emptyForm: PFormState = {
  slug: "", name: "", price: "0", stock: "1", category_id: "",
  brand: "", team: "", league: "", country: "", release_year: "",
  condition: "excellent", sizes: "S,M,L,XL", description: "", story: "",
  collector_score: "1", authenticity_badge: "original_verified", video_url: "", is_active: true,
};

export const Route = createFileRoute("/_authenticated/_admin/admin/produk/$id")({
  component: ProductForm,
});

function ProductForm() {
  const { id } = useParams({ from: "/_authenticated/_admin/admin/produk/$id" });
  const isNew = id === "baru";
  const navigate = useNavigate();
  const [form, setForm] = useState<PFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ id?: string; url: string; storage_path?: string }[]>([]);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const existing = useQuery({
    queryKey: ["product-edit", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*, product_images(*)").eq("id", id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!existing.data) return;
    const p = existing.data;
    setForm({
      slug: p.slug, name: p.name, price: formatThousand(p.price), stock: String(p.stock),
      category_id: p.category_id ?? "", brand: p.brand ?? "", team: p.team ?? "",
      league: p.league ?? "", country: p.country ?? "", release_year: String(p.release_year ?? ""),
      condition: p.condition ?? "excellent", sizes: (p.sizes ?? []).join(","),
      description: p.description ?? "", story: p.story ?? "",
      collector_score: String(p.collector_score), authenticity_badge: p.authenticity_badge ?? "original_verified",
      video_url: p.video_url ?? "", is_active: p.is_active,
    });
    const loadedImages = (p.product_images ?? []).map((i: any) => ({
      id: i.id,
      storage_path: i.url,
      url: supabase.storage.from("product-images").getPublicUrl(i.url).data.publicUrl,
    }));
    setImages(loadedImages);
  }, [existing.data]);

  function set<K extends keyof PFormState>(k: K, v: PFormState[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function uploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const path = `${Date.now()}-${file.name}`;
      await uploadFile("product-images", path, file);
      
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      const url = data.publicUrl;
      
      setImages((arr) => [...arr, { storage_path: path, url }]);
      toast.success("Gambar berhasil diunggah");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengunggah gambar: " + (err as Error).message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        name: form.name, price: Number(form.price.replace(/\D/g, "")), stock: Number(form.stock),
        category_id: form.category_id || null,
        brand: form.brand || null, team: form.team || null, league: form.league || null,
        country: form.country || null, release_year: form.release_year ? Number(form.release_year) : null,
        condition: form.condition as any, sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
        description: form.description || null,
        story: form.story || null,
        collector_score: Number(form.collector_score),
        authenticity_badge: form.authenticity_badge as any,
        video_url: form.video_url || null,
        cover_image_url: images[0]?.url || null,
        is_active: form.is_active,
      };
      let productId = isNew ? null : id;
      if (isNew) {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      } else {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      }
      // Sync images: insert any without id
      const newOnes = images.filter((i) => !i.id && i.storage_path).map((i, idx) => ({
        product_id: productId!, url: i.storage_path!, sort_order: idx,
      }));
      if (newOnes.length) await supabase.from("product_images").insert(newOnes);
      toast.success(isNew ? "Produk dibuat" : "Produk disimpan");
      navigate({ to: "/admin/produk" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow={isNew ? "Produk Baru" : "Edit Produk"} title={isNew ? "Tambah Jersey" : form.name || "Edit"} />
      <form onSubmit={submit} className="space-y-6">
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><Label>Nama Produk</Label><Input required value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><Label>Slug (otomatis jika kosong)</Label><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} /></div>
            <div><Label>Kategori</Label>
              <Select value={form.category_id} onValueChange={(v) => set("category_id", v)}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>{cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Harga (Rp)</Label><Input type="text" required value={form.price} onChange={(e) => set("price", formatThousand(e.target.value))} /></div>
            <div><Label>Stok</Label><Input type="number" required value={form.stock} onChange={(e) => set("stock", e.target.value)} /></div>
            <div><Label>Brand</Label><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
            <div><Label>Tim</Label><Input value={form.team} onChange={(e) => set("team", e.target.value)} /></div>
            <div><Label>Liga</Label><Input value={form.league} onChange={(e) => set("league", e.target.value)} /></div>
            <div><Label>Negara</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div><Label>Tahun Rilis</Label><Input type="number" value={form.release_year} onChange={(e) => set("release_year", e.target.value)} /></div>
            <div><Label>Ukuran (pisahkan koma)</Label><Input value={form.sizes} onChange={(e) => set("sizes", e.target.value)} /></div>
            <div><Label>Kondisi</Label>
              <Select value={form.condition} onValueChange={(v) => set("condition", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["mint","excellent","good","fair"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Collector Score (1-3)</Label>
              <Select value={form.collector_score} onValueChange={(v) => set("collector_score", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["1","2","3"].map(c=><SelectItem key={c} value={c}>{"★".repeat(Number(c))}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Authenticity Badge</Label>
              <Select value={form.authenticity_badge} onValueChange={(v) => set("authenticity_badge", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["original_verified","match_worn","collector_item","limited_edition"].map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Deskripsi</Label><Textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Story di Balik Jersey</Label><Textarea rows={4} value={form.story} onChange={(e) => set("story", e.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Video URL</Label><Input value={form.video_url} onChange={(e) => set("video_url", e.target.value)} /></div>
            <div className="sm:col-span-2 flex items-center justify-between p-4 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
              <div className="space-y-0.5">
                <Label htmlFor="ia" className="text-base font-semibold cursor-pointer">Status Keaktifan Produk</Label>
                <p className="text-xs text-muted-foreground">Aktifkan agar produk ini langsung tampil di katalog beranda dan toko pengunjung.</p>
              </div>
              <Switch
                id="ia"
                checked={form.is_active}
                onCheckedChange={(val) => set("is_active", val)}
                className="scale-125 data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </Card>

        <Card>
          <Label>Gambar Produk (gambar pertama menjadi cover)</Label>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-square bg-muted overflow-hidden">
                <img src={img.url} alt="" className="size-full object-cover" />
                <button type="button" onClick={() => setImages((arr) => arr.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-background/90 p-1"><Trash2 className="size-3" /></button>
              </div>
            ))}
            <label className="aspect-square border-2 border-dashed border-border grid place-items-center text-xs text-muted-foreground cursor-pointer hover:border-primary">
              + Upload
              <input type="file" accept="image/*" onChange={uploadImage} className="hidden" />
            </label>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>{loading ? "Menyimpan..." : (isNew ? "Buat Produk" : "Simpan Perubahan")}</Button>
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/admin/produk" })}>Batal</Button>
        </div>
      </form>
    </DashboardShell>
  );
}
