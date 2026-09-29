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
import {
  Plus,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Image,
  Coins,
  TrendingUp,
  Tag,
  Shirt,
  Layers,
  Sparkles,
  Star,
  Check,
} from "lucide-react";
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

function calculateProductCostAndStock(p: any) {
  const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
  const sizeCostMap = (rawStock["_cost_prices"] || p.size_cost_price || {}) as Record<string, any>;
  const defaultCost = Number(p.cost_price ?? 0);
  const stockEntries = Object.entries(rawStock).filter(([k]) => !k.startsWith("_"));

  if (stockEntries.length > 0) {
    let totalStock = 0;
    let totalCost = 0;
    stockEntries.forEach(([sz, qtyVal]) => {
      const qty = Number(qtyVal) || 0;
      const szCost =
        sizeCostMap[sz] !== undefined && Number(sizeCostMap[sz]) > 0
          ? Number(sizeCostMap[sz])
          : defaultCost;
      totalStock += qty;
      totalCost += szCost * qty;
    });
    return { stock: totalStock, totalCost };
  }

  const stock = Number(p.stock ?? 0);
  return { stock, totalCost: defaultCost * stock };
}

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
  >("name");
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
          .order("name", { ascending: true })
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

  function calculateProductCostAndStock(p: any) {
    const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
    const sizeCostMap = rawStock["_cost_prices"] || p.size_cost_price || {};
    const defaultCost = Number(p.cost_price ?? 0);

    const stockEntries = Object.entries(rawStock).filter(([k]) => !k.startsWith("_"));
    let totalCost = 0;
    let totalStock = 0;

    if (stockEntries.length > 0) {
      stockEntries.forEach(([sizeKey, qtyVal]) => {
        const qty = Number(qtyVal) || 0;
        totalStock += qty;
        const cost =
          sizeCostMap[sizeKey] !== undefined && Number(sizeCostMap[sizeKey]) > 0
            ? Number(sizeCostMap[sizeKey])
            : defaultCost;
        totalCost += cost * qty;
      });
    } else {
      totalStock = Number(p.stock) || 0;
      totalCost = defaultCost * totalStock;
    }

    return { totalCost, stock: totalStock };
  }

  const allProducts = q.data ?? [];

  // 1. Total Modal (HPP Inventaris Keseluruhan - Ukuran Spesifik)
  const totalCostValue = allProducts.reduce((sum, p) => {
    return sum + calculateProductCostAndStock(p).totalCost;
  }, 0);

  // 2. Total Nilai Jual (Potensi Omset Keseluruhan)
  const totalSellingValue = allProducts.reduce((sum, p) => {
    const price = Number(p.price ?? 0);
    const qty = calculateProductCostAndStock(p).stock;
    return sum + price * qty;
  }, 0);

  // 3. Total Potensi Keuntungan (Laba Bersih Inventaris)
  const totalPotentialProfit = totalSellingValue - totalCostValue;
  const overallMarginPercent =
    totalSellingValue > 0 ? (totalPotentialProfit / totalSellingValue) * 100 : 0;

  // 4. Volume Katalog & Stok
  const totalJerseyModels = allProducts.length;
  const totalStockPcs = allProducts.reduce((sum, p) => sum + calculateProductCostAndStock(p).stock, 0);

  const filteredProducts = allProducts.filter((p) => {
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
    } else if (sortField === "category") {
      valA = (a.categories?.name ?? "").toLowerCase();
    } else if (sortField === "stock") {
      valA = a.stock;
    } else if (sortField === "price") {
      valA = a.price;
    } else if (sortField === "is_active") {
      valA = a.is_active ? 1 : 0;
    }

    if (sortField === "name") {
      valB = b.name.toLowerCase();
    } else if (sortField === "category") {
      valB = (b.categories?.name ?? "").toLowerCase();
    } else if (sortField === "stock") {
      valB = b.stock;
    } else if (sortField === "price") {
      valB = b.price;
    } else if (sortField === "is_active") {
      valB = b.is_active ? 1 : 0;
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Katalog Toko"
        title="Manajemen Produk"
        action={
          <Button asChild size="sm" className="gap-1.5 shadow-sm text-xs font-bold h-9">
            <Link to="/admin/produk/$id" params={{ id: "baru" }}>
              <Plus className="size-4" />
              Tambah Produk
            </Link>
          </Button>
        }
      />

      {/* 4 Statistik Finansial & Inventaris Produk - 2 per baris di mobile, 4 di desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
        {/* Card 1: Total Modal Stok */}
        <div className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card/60 shadow-sm flex flex-col justify-between" title={`Total modal HPP dari ${totalStockPcs} pcs jersey yang saat ini masih ada di stok gudang`}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Modal Sisa Stok (HPP)
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Coins className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground truncate">
              {formatIDR(totalCostValue)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              Modal <span className="font-semibold text-foreground">{totalStockPcs} pcs</span> sisa di gudang
            </p>
          </div>
        </div>

        {/* Card 2: Total Nilai Jual */}
        <div className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card/60 shadow-sm flex flex-col justify-between" title={`Potensi total omset jika seluruh ${totalStockPcs} pcs jersey sisa stok terjual`}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Potensi Nilai Jual
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <Tag className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground truncate">
              {formatIDR(totalSellingValue)}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              Jika sisa stok terjual habis
            </p>
          </div>
        </div>

        {/* Card 3: Total Potensi Keuntungan */}
        <div className="p-3 sm:p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03] shadow-sm flex flex-col justify-between" title={`Estimasi keuntungan bersih jika seluruh ${totalStockPcs} pcs jersey sisa stok terjual habis`}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Potensi Laba (Estimasi)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 truncate">
              {formatIDR(totalPotentialProfit)}
            </div>
            <p className="text-[10px] sm:text-xs text-emerald-600/90 dark:text-emerald-400/90 mt-0.5 font-semibold truncate">
              Margin {overallMarginPercent.toFixed(0)}% • Jika stok laku semua
            </p>
          </div>
        </div>

        {/* Card 4: Total Volume Katalog */}
        <div className="p-3 sm:p-4 rounded-xl border border-border/80 bg-card/60 shadow-sm flex flex-col justify-between" title={`Jumlah stok jersey yang saat ini masih tersedia untuk dijual`}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Stok Tersedia
            </span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <Shirt className="size-3.5 sm:size-4" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground truncate">
              {totalStockPcs} Pcs
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
              Dari {totalJerseyModels} model jersey
            </p>
          </div>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, klub, brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-9 w-full text-xs placeholder:text-xs placeholder:text-muted-foreground/80"
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

          <div className="w-full sm:w-[180px]">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-full">
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

          <div className="w-full sm:w-[140px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Tidak Aktif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full sm:w-[140px]">
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="h-9 w-full">
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
            <>
              {/* Mobile Product Card List (< lg) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
                {sortedProducts.map((p) => {
                  const sizes = (p.sizes ?? []) as string[];
                  const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
                  const sizeCostMap = rawStock["_cost_prices"] || (p as any).size_cost_price || {};
                  const defaultCost = Number((p as any).cost_price ?? 0);

                  const costsList: { size: string; cost: number }[] = sizes.map((s) => ({
                    size: s,
                    cost:
                      sizeCostMap[s] !== undefined && Number(sizeCostMap[s]) > 0
                        ? Number(sizeCostMap[s])
                        : defaultCost,
                  }));

                  const allCosts = costsList.map((c) => c.cost).filter((c) => c > 0);
                  const minCost = allCosts.length > 0 ? Math.min(...allCosts) : defaultCost;
                  const maxCost = allCosts.length > 0 ? Math.max(...allCosts) : defaultCost;
                  const hasCostVariation = minCost !== maxCost && allCosts.length > 1;

                  const sell = Number(p.price ?? 0);
                  const minProfit = sell - maxCost;
                  const maxProfit = sell - minCost;
                  const minMargin = sell > 0 ? (minProfit / sell) * 100 : 0;
                  const maxMargin = sell > 0 ? (maxProfit / sell) * 100 : 0;
                  const isSpotlight = (p as any).is_spotlight === true;

                  const stockEntries = Object.entries(rawStock).filter(([k]) => !k.startsWith("_"));
                  const realTotalStock =
                    stockEntries.length > 0
                      ? stockEntries.reduce((sum, [, val]) => sum + (Number(val) || 0), 0)
                      : p.stock ?? 0;

                  const categoryNames =
                    Array.isArray(p.category_ids) && p.category_ids.length > 0
                      ? categoriesQuery.data
                          ?.filter((c) => p.category_ids.includes(c.id))
                          .map((c) => c.name)
                          .join(", ") || "—"
                      : p.categories?.name ?? "—";

                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "p-3.5 rounded-xl border border-border bg-card/60 space-y-3 shadow-sm relative",
                        isSpotlight && "border-amber-500/40 bg-amber-500/[0.02]",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-14 bg-muted rounded-lg border border-border overflow-hidden shrink-0 flex items-center justify-center relative">
                          {p.cover_image_url ? (
                            <img src={p.cover_image_url} alt="" className="size-full object-cover" />
                          ) : (
                            <Image className="size-5 text-muted-foreground/50" />
                          )}
                          {isSpotlight && (
                            <div className="absolute top-0 right-0 bg-amber-500 text-black p-0.5 rounded-bl shadow">
                              <Star className="size-2.5 fill-current" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            to="/admin/produk/$id"
                            params={{ id: p.id }}
                            className="font-bold text-xs sm:text-sm text-foreground hover:underline line-clamp-1 block"
                          >
                            {p.name}
                          </Link>
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {p.team ? `${p.team} · ` : ""}
                            {categoryNames}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span
                              className={cn(
                                "text-[10px] font-extrabold px-2 py-0.5 rounded-full border",
                                realTotalStock === 0
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : realTotalStock <= 5
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                              )}
                            >
                              Stok: {realTotalStock} pcs
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                p.is_active
                                  ? "bg-muted text-foreground border-border"
                                  : "bg-rose-500/5 text-rose-500 border-rose-500/20",
                              )}
                            >
                              {p.is_active ? "Aktif" : "Non-aktif"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Pricing & Profit Matrix */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground block">Harga Jual:</span>
                          <span className="font-extrabold text-foreground">{formatIDR(sell)}</span>
                          {p.original_price && p.original_price > p.price && (
                            <span className="text-[10px] text-muted-foreground line-through block">
                              {formatIDR(p.original_price)}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] text-muted-foreground block">Keuntungan:</span>
                          <span
                            className={cn(
                              "font-bold",
                              maxProfit > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : maxProfit < 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-muted-foreground",
                            )}
                          >
                            {hasCostVariation
                              ? `${formatIDR(minProfit)} – ${formatIDR(maxProfit)}`
                              : formatIDR(maxProfit)}
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">
                            {hasCostVariation
                              ? `Margin ${minMargin.toFixed(0)}% – ${maxMargin.toFixed(0)}%`
                              : `Margin ${maxMargin.toFixed(0)}%`}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Card Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/50">
                        <button
                          type="button"
                          title={isSpotlight ? "Jersey Spotlight Utama saat ini" : "Jadikan Jersey Spotlight di Halaman Depan"}
                          onClick={async (e) => {
                            e.preventDefault();
                            try {
                              if (!isSpotlight) {
                                await supabase.from("products").update({ is_spotlight: false } as any).neq("id", p.id);
                                await supabase.from("products").update({ is_spotlight: true } as any).eq("id", p.id);
                                toast.success(`"${p.name}" sekarang menjadi Spotlight di Beranda!`);
                              } else {
                                await supabase.from("products").update({ is_spotlight: false } as any).eq("id", p.id);
                                toast.info(`Spotlight "${p.name}" dinonaktifkan.`);
                              }
                              qc.invalidateQueries({ queryKey: ["admin-products"] });
                              qc.invalidateQueries({ queryKey: ["homepage-spotlight-product"] });
                            } catch (err: any) {
                              toast.error("Gagal mengubah spotlight: " + err.message);
                            }
                          }}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                            isSpotlight
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                              : "text-muted-foreground hover:text-foreground bg-muted/60 border border-border",
                          )}
                        >
                          <Star className={cn("size-3.5", isSpotlight ? "fill-amber-500 text-amber-500" : "fill-none")} />
                          <span>{isSpotlight ? "Spotlight Aktif" : "Set Spotlight"}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <Button asChild size="sm" variant="outline" className="h-8 px-3 text-xs font-semibold">
                            <Link to="/admin/produk/$id" params={{ id: p.id }}>
                              Edit
                            </Link>
                          </Button>
                          <button
                            onClick={() => handleDeleteSingle(p.id)}
                            className="size-8 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 grid place-items-center cursor-pointer transition-colors"
                            aria-label="Hapus Produk"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= lg) */}
              <div className="hidden lg:block overflow-x-auto">
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
                      <th className="py-2 pr-4 text-center">Spotlight</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.map((p) => {
                      const sizes = (p.sizes ?? []) as string[];
                      const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
                      const sizeCostMap = rawStock["_cost_prices"] || (p as any).size_cost_price || {};
                      const defaultCost = Number((p as any).cost_price ?? 0);

                      // Extract costs per size
                      const costsList: { size: string; cost: number }[] = sizes.map((s) => ({
                        size: s,
                        cost:
                          sizeCostMap[s] !== undefined && Number(sizeCostMap[s]) > 0
                            ? Number(sizeCostMap[s])
                            : defaultCost,
                      }));

                      const allCosts = costsList.map((c) => c.cost).filter((c) => c > 0);
                      const minCost = allCosts.length > 0 ? Math.min(...allCosts) : defaultCost;
                      const maxCost = allCosts.length > 0 ? Math.max(...allCosts) : defaultCost;
                      const hasCostVariation = minCost !== maxCost && allCosts.length > 1;

                      const sell = Number(p.price ?? 0);
                      const minProfit = sell - maxCost;
                      const maxProfit = sell - minCost;
                      const minMargin = sell > 0 ? (minProfit / sell) * 100 : 0;
                      const maxMargin = sell > 0 ? (maxProfit / sell) * 100 : 0;
                      const isSpotlight = (p as any).is_spotlight === true;

                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            "border-b border-border/50 hover:bg-muted/10 transition-colors",
                            isSpotlight && "bg-amber-500/5",
                          )}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="size-10 bg-muted rounded border border-border overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                                {p.cover_image_url ? (
                                  <img
                                    src={p.cover_image_url}
                                    alt=""
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  <Image className="size-5 text-muted-foreground/50" />
                                )}
                                {isSpotlight && (
                                  <div className="absolute top-0 right-0 bg-amber-500 text-black p-0.5 rounded-bl shadow">
                                    <Star className="size-2.5 fill-current" />
                                  </div>
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
                          <td className="text-xs pr-4 font-medium">
                            {(() => {
                              const stockEntries = Object.entries(rawStock).filter(([k]) => !k.startsWith("_"));
                              const realTotalStock =
                                stockEntries.length > 0
                                  ? stockEntries.reduce((sum, [, val]) => sum + (Number(val) || 0), 0)
                                  : p.stock ?? 0;

                              const isAllZero = realTotalStock === 0;
                              const isLow = realTotalStock > 0 && realTotalStock <= 5;

                              return (
                                <div className="flex flex-col gap-0.5">
                                  <span
                                    className={cn(
                                      "font-bold",
                                      isAllZero
                                        ? "text-rose-600 dark:text-rose-400"
                                        : isLow
                                          ? "text-amber-600 dark:text-amber-400"
                                          : "text-foreground",
                                    )}
                                  >
                                    {realTotalStock} pcs
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {isAllZero ? "Habis" : isLow ? "Menipis" : "Tersedia"}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="tabular-nums text-xs pr-4">
                            {hasCostVariation ? (
                              <div className="flex flex-col gap-0.5 group/cost relative cursor-help">
                                <span className="font-semibold text-foreground">
                                  {formatIDR(minCost)} – {formatIDR(maxCost)}
                                </span>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <span className="underline decoration-dotted underline-offset-2">
                                    {sizes.length} Size (Beda HPP)
                                  </span>
                                </div>
                                {/* Hover Tooltip breakdown */}
                                <div className="hidden group-hover/cost:flex flex-col gap-1 absolute bottom-full left-0 mb-1 z-30 bg-popover text-popover-foreground border border-border px-2.5 py-1.5 rounded-lg shadow-xl text-[11px] whitespace-nowrap pointer-events-none">
                                  <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                                    Rincian Modal Ukuran:
                                  </span>
                                  {costsList.map((c) => (
                                    <div key={c.size} className="flex justify-between gap-3 text-xs">
                                      <span className="font-semibold">Size {c.size}:</span>
                                      <span className="font-mono text-primary font-bold">{formatIDR(c.cost)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{formatIDR(minCost || defaultCost)}</span>
                            )}
                          </td>
                          <td className="tabular-nums pr-4">
                            <div className="flex flex-col">
                              {p.original_price && p.original_price > p.price && (
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-[10px] text-muted-foreground line-through">
                                    {formatIDR(p.original_price)}
                                  </span>
                                  <span className="text-[9px] text-rose-600 dark:text-rose-400 bg-rose-500/15 font-extrabold px-1 rounded leading-none py-0.5">
                                    -{Math.round(((p.original_price - p.price) / p.original_price) * 100)}%
                                  </span>
                                </div>
                              )}
                              <span className="text-xs font-semibold">{formatIDR(sell)}</span>
                            </div>
                          </td>
                          <td className="tabular-nums pr-4">
                            {hasCostVariation ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "text-xs font-bold",
                                      minProfit > 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : minProfit < 0
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-muted-foreground",
                                    )}
                                  >
                                    {formatIDR(minProfit)} – {formatIDR(maxProfit)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                                    {minMargin.toFixed(0)}% – {maxMargin.toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    "text-xs font-bold",
                                    maxProfit > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : maxProfit < 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-muted-foreground",
                                  )}
                                >
                                  {formatIDR(maxProfit)}
                                </span>
                                {maxProfit > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-500/20">
                                    {maxMargin.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="text-xs pr-4">
                            {p.is_active ? (
                              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400 inline" />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="text-xs pr-4 text-center">
                            <button
                              type="button"
                              title={isSpotlight ? "Jersey Spotlight Utama saat ini" : "Jadikan Jersey Spotlight di Halaman Depan"}
                              onClick={async (e) => {
                                e.preventDefault();
                                try {
                                  if (!isSpotlight) {
                                    await supabase.from("products").update({ is_spotlight: false } as any).neq("id", p.id);
                                    await supabase.from("products").update({ is_spotlight: true } as any).eq("id", p.id);
                                    toast.success(`"${p.name}" sekarang menjadi Spotlight di Beranda!`);
                                  } else {
                                    await supabase.from("products").update({ is_spotlight: false } as any).eq("id", p.id);
                                    toast.info(`Spotlight "${p.name}" dinonaktifkan.`);
                                  }
                                  qc.invalidateQueries({ queryKey: ["admin-products"] });
                                  qc.invalidateQueries({ queryKey: ["homepage-spotlight-product"] });
                                } catch (err: any) {
                                  toast.error("Gagal mengubah spotlight: " + err.message);
                                }
                              }}
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer",
                                isSpotlight
                                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-sm"
                                  : "text-muted-foreground/60 hover:text-foreground hover:bg-muted border border-transparent",
                              )}
                            >
                              <Star className={cn("size-3.5", isSpotlight ? "fill-amber-500 text-amber-500" : "fill-none")} />
                              <span>{isSpotlight ? "Utama" : "Pilih"}</span>
                            </button>
                          </td>
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
            </>
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
