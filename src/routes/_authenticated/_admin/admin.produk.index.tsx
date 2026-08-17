import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, X, Image } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sortField, setSortField] = useState<
    "name" | "category" | "stock" | "price" | "is_active" | null
  >(null);
  const [sortAsc, setSortAsc] = useState(true);

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  const q = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("*, categories(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
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
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      (p.team && p.team.toLowerCase().includes(term)) ||
      (p.categories?.name && p.categories.name.toLowerCase().includes(term));

    if (!matchesSearch) return false;

    if (categoryFilter !== "all") {
      const hasCategory =
        p.category_id === categoryFilter ||
        (Array.isArray(p.category_ids) && p.category_ids.includes(categoryFilter));
      if (!hasCategory) return false;
    }

    if (statusFilter !== "all") {
      const wantActive = statusFilter === "active";
      if (p.is_active !== wantActive) return false;
    }

    if (stockFilter !== "all") {
      if (stockFilter === "empty" && p.stock !== 0) return false;
      if (stockFilter === "low" && (p.stock === 0 || p.stock > 5)) return false;
      if (stockFilter === "available" && p.stock === 0) return false;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (!sortField) return 0;

    let valA: string | number = "";
    let valB: string | number = "";

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
      <PageHeader
        eyebrow="Produk"
        title="Manajemen Produk"
        action={
          <Button asChild>
            <Link to="/admin/produk/$id" params={{ id: "baru" }}>
              <Plus className="size-4 mr-1" />
              Tambah Produk
            </Link>
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
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

          <div className="w-[180px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pilih Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categoriesQuery.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[140px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-[140px]">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Pilih Stok" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Stok</SelectItem>
                <SelectItem value="available">Tersedia</SelectItem>
                <SelectItem value="low">Stok Menipis (≤ 5)</SelectItem>
                <SelectItem value="empty">Stok Habis (0)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {q.data?.length ? (
          filteredProducts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                    <th
                      className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Nama
                        {sortField === "name" ? (
                          sortAsc ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center gap-1">
                        Kategori
                        {sortField === "category" ? (
                          sortAsc ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th
                      className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("stock")}
                    >
                      <div className="flex items-center gap-1">
                        Stok
                        {sortField === "stock" ? (
                          sortAsc ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4">Modal (HPP)</th>
                    <th
                      className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("price")}
                    >
                      <div className="flex items-center gap-1">
                        Harga Jual
                        {sortField === "price" ? (
                          sortAsc ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th className="py-2 pr-4">Keuntungan / Pcs</th>
                    <th
                      className="py-2 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("is_active")}
                    >
                      <div className="flex items-center gap-1">
                        Aktif
                        {sortField === "is_active" ? (
                          sortAsc ? (
                            <ArrowUp className="size-3 text-primary" />
                          ) : (
                            <ArrowDown className="size-3 text-primary" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                        )}
                      </div>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((p) => {
                    const cost = Number(p.cost_price ?? 0);
                    const sell = Number(p.price ?? 0);
                    const profit = sell - cost;
                    const margin = sell > 0 ? (profit / sell) * 100 : 0;

                    return (
                      <tr
                        key={p.id}
                        className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="size-10 bg-muted rounded border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {p.cover_image_url ? (
                                <img
                                  src={p.cover_image_url}
                                  alt=""
                                  className="size-full object-cover"
                                />
                              ) : (
                                <Image className="size-5 text-muted-foreground/50" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to="/admin/produk/$id"
                                params={{ id: p.id }}
                                className="font-semibold hover:underline block truncate max-w-[240px]"
                              >
                                {p.name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{p.team || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-xs pr-4 max-w-[130px] truncate">
                          {Array.isArray(p.category_ids) && p.category_ids.length > 0
                            ? categoriesQuery.data
                                ?.filter((c) => p.category_ids.includes(c.id))
                                .map((c) => c.name)
                                .join(", ") || "—"
                            : (p.categories?.name ?? "—")}
                        </td>
                        <td className="text-xs pr-4 font-medium">{p.stock}</td>
                        <td className="tabular-nums text-xs text-muted-foreground pr-4">
                          {formatIDR(cost)}
                        </td>
                        <td className="tabular-nums text-xs font-semibold pr-4">
                          {formatIDR(sell)}
                        </td>
                        <td className="tabular-nums pr-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs font-bold",
                                profit > 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : profit < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-muted-foreground",
                              )}
                            >
                              {formatIDR(profit)}
                            </span>
                            {profit > 0 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                                {margin.toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-xs pr-4">{p.is_active ? "✓" : "—"}</td>
                        <td>
                          <button
                            onClick={() => handleDeleteSingle(p.id)}
                            className="text-destructive hover:opacity-70 cursor-pointer"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Tidak ada produk yang cocok dengan pencarian Anda.
            </p>
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
