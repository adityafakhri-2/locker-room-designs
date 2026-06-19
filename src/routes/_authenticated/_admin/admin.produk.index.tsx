import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { Plus, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_admin/admin/produk/")({
  component: AdminProducts,
});

function AdminProducts() {
  const qc = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "category" | "stock" | "price" | "is_active" | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const q = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false })).data ?? [],
  });
  
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { 
      toast.success("Produk dihapus"); 
      qc.invalidateQueries({ queryKey: ["admin-products"] }); 
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleDeleteSingle(id: string) {
    setDeleteProductId(id);
    setDeleteConfirmOpen(true);
  }

  function handleSort(field: "name" | "category" | "stock" | "price" | "is_active") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const filteredProducts = (q.data ?? []).filter((p) => {
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.team && p.team.toLowerCase().includes(term)) ||
      (p.categories?.name && p.categories.name.toLowerCase().includes(term))
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;
    
    let valA: any = "";
    let valB: any = "";
    
    if (sortField === "name") {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortField === "category") {
      valA = (a.categories?.name ?? "").toLowerCase();
      valB = (b.categories?.name ?? "").toLowerCase();
    } else if (sortField === "stock") {
      valA = a.stock;
      valB = b.stock;
    } else if (sortField === "price") {
      valA = a.price;
      valB = b.price;
    } else if (sortField === "is_active") {
      valA = a.is_active ? 1 : 0;
      valB = b.is_active ? 1 : 0;
    }
    
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Produk" title="Manajemen Produk" action={
        <Button asChild><Link to="/admin/produk/$id" params={{ id: "baru" }}><Plus className="size-4 mr-1" />Tambah Produk</Link></Button>
      } />
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Cari nama, tim, atau kategori..." 
              className="pl-9 pr-9 h-9"
            />
            {search && (
              <button 
                onClick={() => setSearch("")} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        {q.data?.length ? (
          filteredProducts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group" onClick={() => handleSort("name")}>
                      <div className="flex items-center gap-1">
                        Nama
                        {sortField === "name" ? (
                          sortAsc ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group" onClick={() => handleSort("category")}>
                      <div className="flex items-center gap-1">
                        Kategori
                        {sortField === "category" ? (
                          sortAsc ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group" onClick={() => handleSort("stock")}>
                      <div className="flex items-center gap-1">
                        Stok
                        {sortField === "stock" ? (
                          sortAsc ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group" onClick={() => handleSort("price")}>
                      <div className="flex items-center gap-1">
                        Harga
                        {sortField === "price" ? (
                          sortAsc ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group" onClick={() => handleSort("is_active")}>
                      <div className="flex items-center gap-1">
                        Aktif
                        {sortField === "is_active" ? (
                          sortAsc ? <ArrowUp className="size-3 text-primary" /> : <ArrowDown className="size-3 text-primary" />
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-3 pr-4">
                        <Link to="/admin/produk/$id" params={{ id: p.id }} className="font-semibold hover:underline">
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{p.team}</div>
                      </td>
                      <td className="text-xs pr-4">{p.categories?.name ?? "—"}</td>
                      <td className="text-xs pr-4">{p.stock}</td>
                      <td className="tabular-nums pr-4">{formatIDR(p.price)}</td>
                      <td className="text-xs pr-4">{p.is_active ? "✓" : "—"}</td>
                      <td>
                        <button onClick={() => handleDeleteSingle(p.id)} className="text-destructive hover:opacity-70 cursor-pointer">
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Tidak ada produk yang cocok dengan pencarian Anda.</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">
            Belum ada produk.{" "}
            <Link to="/admin/produk/$id" params={{ id: "baru" }} className="text-primary underline">
              Tambah produk pertama
            </Link>
          </p>
        )}
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Produk</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (deleteProductId) {
                  del.mutate(deleteProductId);
                }
                setDeleteConfirmOpen(false);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
