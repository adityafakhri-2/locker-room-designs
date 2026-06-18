import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/produk/")({
  component: AdminProducts,
});

function AdminProducts() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Produk dihapus"); qc.invalidateQueries({ queryKey: ["admin-products"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Produk" title="Manajemen Produk" action={
        <Button asChild><Link to="/admin/produk/baru"><Plus className="size-4 mr-1" />Tambah Produk</Link></Button>
      } />
      <Card>
        {q.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border">
                <th className="py-2">Nama</th><th>Kategori</th><th>Stok</th><th>Harga</th><th>Aktif</th><th></th>
              </tr></thead>
              <tbody>
                {q.data.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3"><Link to="/admin/produk/$id" params={{ id: p.id }} className="font-semibold hover:underline">{p.name}</Link><div className="text-xs text-muted-foreground">{p.team}</div></td>
                    <td className="text-xs">{p.categories?.name ?? "—"}</td>
                    <td className="text-xs">{p.stock}</td>
                    <td className="tabular-nums">{formatIDR(p.price)}</td>
                    <td className="text-xs">{p.is_active ? "✓" : "—"}</td>
                    <td><button onClick={() => { if (confirm("Hapus produk ini?")) del.mutate(p.id); }} className="text-destructive hover:opacity-70"><Trash2 className="size-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">Belum ada produk. <Link to="/admin/produk/baru" className="text-primary underline">Tambah produk pertama</Link></p>}
      </Card>
    </DashboardShell>
  );
}
