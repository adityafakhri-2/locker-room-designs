import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { formatDate, formatIDR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  UserX,
  Users,
  Shirt,
  ShoppingBag,
  Store,
  Globe,
  TrendingUp,
  MapPin,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_admin/admin/pelanggan")({
  component: AdminCustomers,
});

export interface UnifiedCustomer {
  id: string;
  nama_lengkap: string;
  email: string;
  no_hp: string;
  kota: string;
  alamat: string;
  created_at: string;
  type: "online" | "offline";
  totalOrders: number;
  totalJerseys: number;
  totalSpent: number;
  lastOrderDate: string;
  associatedOrderIds?: string[];
}

function AdminCustomers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "online" | "offline">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<
    "nama" | "jerseys" | "spent" | "orders" | "created_at"
  >("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const q = useQuery({
    queryKey: ["admin-customers-unified"],
    queryFn: async () => {
      // 1. Fetch Registered Customer Profiles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");

      const registeredCustomerIds = roles?.map((r) => r.user_id) ?? [];
      let profiles: any[] = [];
      if (registeredCustomerIds.length > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", registeredCustomerIds);
        profiles = profData ?? [];
      }

      // 2. Fetch All Orders with Order Items
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, user_id, recipient_name, recipient_no_hp, recipient_kota, recipient_alamat, grand_total, status, created_at, order_items(quantity, product_name)")
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw new Error(ordersError.message);
      }

      const allOrders = ordersData ?? [];
      const customerMap = new Map<string, UnifiedCustomer>();
      const registeredUserIdsSet = new Set(registeredCustomerIds);

      // Process Registered Customers
      profiles.forEach((p) => {
        const userOrders = allOrders.filter((o) => o.user_id === p.id);
        const totalJerseys = userOrders.reduce((sum, o) => {
          const items = Array.isArray(o.order_items) ? o.order_items : [];
          return sum + items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0);
        }, 0);
        const totalSpent = userOrders
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);
        const lastOrder = userOrders[0];

        customerMap.set(p.id, {
          id: p.id,
          nama_lengkap: p.nama_lengkap || "Pelanggan Online",
          email: p.email || "—",
          no_hp: p.no_hp || "—",
          kota: p.kota || "—",
          alamat: p.alamat || "—",
          created_at: p.created_at,
          type: "online",
          totalOrders: userOrders.length,
          totalJerseys: totalJerseys,
          totalSpent: totalSpent,
          lastOrderDate: lastOrder ? lastOrder.created_at : p.created_at,
          associatedOrderIds: userOrders.map((o) => o.id),
        });
      });

      // Process Offline / Manual Orders (not belonging to registered customers)
      const offlineOrders = allOrders.filter(
        (o) => !o.user_id || !registeredUserIdsSet.has(o.user_id),
      );

      // Group offline orders by recipient name & phone
      const offlineGroups = new Map<string, typeof offlineOrders>();
      offlineOrders.forEach((o) => {
        const cleanName = (o.recipient_name || "Pelanggan Offline (Walk-in)").trim();
        const cleanPhone = (o.recipient_no_hp || "").trim();
        const key = `${cleanName.toLowerCase()}___${cleanPhone}`;
        if (!offlineGroups.has(key)) {
          offlineGroups.set(key, []);
        }
        offlineGroups.get(key)!.push(o);
      });

      offlineGroups.forEach((groupOrders, key) => {
        const firstOrder = groupOrders[0];
        const lastOrder = groupOrders[groupOrders.length - 1];
        const offlineId = `offline-${firstOrder.id}`;

        const totalJerseys = groupOrders.reduce((sum, o) => {
          const items = Array.isArray(o.order_items) ? o.order_items : [];
          return sum + items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0);
        }, 0);

        const totalSpent = groupOrders
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0);

        customerMap.set(offlineId, {
          id: offlineId,
          nama_lengkap: firstOrder.recipient_name || "Pelanggan Kasir / Offline",
          email: "— (Transaksi Kasir)",
          no_hp: firstOrder.recipient_no_hp && firstOrder.recipient_no_hp !== "-" ? firstOrder.recipient_no_hp : "—",
          kota: firstOrder.recipient_kota || "Kota Cimahi",
          alamat: firstOrder.recipient_alamat || "Outlet Toko",
          created_at: lastOrder.created_at,
          type: "offline",
          totalOrders: groupOrders.length,
          totalJerseys: totalJerseys,
          totalSpent: totalSpent,
          lastOrderDate: firstOrder.created_at,
          associatedOrderIds: groupOrders.map((o) => o.id),
        });
      });

      return Array.from(customerMap.values());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (customerIds: string[]) => {
      const registeredIds = customerIds.filter((id) => !id.startsWith("offline-"));
      const offlineIds = customerIds.filter((id) => id.startsWith("offline-"));

      // Delete registered accounts
      if (registeredIds.length > 0) {
        await supabase.from("wishlists").delete().in("user_id", registeredIds);
        await supabase.from("cart_items").delete().in("user_id", registeredIds);
        await supabase.from("addresses").delete().in("user_id", registeredIds);
        await supabase.from("user_roles").delete().in("user_id", registeredIds).eq("role", "customer");
        await supabase.from("profiles").delete().in("id", registeredIds);
      }

      // If deleting offline customer entries, delete their associated manual orders
      if (offlineIds.length > 0) {
        const orderIdsToDelete: string[] = [];
        offlineIds.forEach((offId) => {
          const cust = q.data?.find((c) => c.id === offId);
          if (cust?.associatedOrderIds) {
            orderIdsToDelete.push(...cust.associatedOrderIds);
          }
        });
        if (orderIdsToDelete.length > 0) {
          await supabase.from("orders").delete().in("id", orderIdsToDelete);
        }
      }
    },
    onSuccess: (_, customerIds) => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers-unified"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats-profit"] });
      setSelectedIds((prev) => prev.filter((id) => !customerIds.includes(id)));
      setDeleteConfirmOpen(false);
      setTargetDeleteIds([]);
      toast.success(
        customerIds.length > 1
          ? `Berhasil menghapus ${customerIds.length} data pelanggan`
          : "Berhasil menghapus data pelanggan",
      );
    },
    onError: (err: any) => {
      toast.error(`Gagal menghapus pelanggan: ${err.message || "Terjadi kesalahan"}`);
    },
  });

  // Calculate Overall Customer Stats
  const stats = useMemo(() => {
    const list = q.data ?? [];
    const total = list.length;
    const online = list.filter((c) => c.type === "online").length;
    const offline = list.filter((c) => c.type === "offline").length;
    const totalJerseysSold = list.reduce((sum, c) => sum + c.totalJerseys, 0);
    const totalRevenue = list.reduce((sum, c) => sum + c.totalSpent, 0);
    const avgJerseysPerCustomer = total > 0 ? (totalJerseysSold / total).toFixed(1) : "0";

    return {
      total,
      online,
      offline,
      totalJerseysSold,
      totalRevenue,
      avgJerseysPerCustomer,
    };
  }, [q.data]);

  const filteredAndSorted = useMemo(() => {
    let list = q.data ? [...q.data] : [];

    // Filter by type
    if (typeFilter !== "all") {
      list = list.filter((c) => c.type === typeFilter);
    }

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.nama_lengkap.toLowerCase().includes(s) ||
          p.email.toLowerCase().includes(s) ||
          p.no_hp.includes(s) ||
          p.kota.toLowerCase().includes(s),
      );
    }

    list.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortField === "nama") {
        valA = a.nama_lengkap.toLowerCase();
        valB = b.nama_lengkap.toLowerCase();
      } else if (sortField === "jerseys") {
        valA = a.totalJerseys;
        valB = b.totalJerseys;
      } else if (sortField === "spent") {
        valA = a.totalSpent;
        valB = b.totalSpent;
      } else if (sortField === "orders") {
        valA = a.totalOrders;
        valB = b.totalOrders;
      } else if (sortField === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [q.data, search, typeFilter, sortField, sortAsc]);

  function handleSort(field: "nama" | "jerseys" | "spent" | "orders" | "created_at") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(filteredAndSorted.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  }

  function handleDeleteSingle(id: string) {
    setTargetDeleteIds([id]);
    setDeleteConfirmOpen(true);
  }

  function handleDeleteBulk() {
    if (selectedIds.length === 0) return;
    setTargetDeleteIds(selectedIds);
    setDeleteConfirmOpen(true);
  }

  const isAllSelected =
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every((p) => selectedIds.includes(p.id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Pelanggan"
        title="Daftar Pelanggan"
        action={
          selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteBulk}
              disabled={deleteMutation.isPending}
              className="gap-1.5 font-semibold shadow-sm text-xs h-9 cursor-pointer"
            >
              <Trash2 className="size-4" />
              <span>Hapus Terpilih ({selectedIds.length})</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border">
              <Users className="size-4 text-primary" />
              <span>
                Total: <strong className="text-foreground">{stats.total}</strong> Pelanggan
              </span>
            </div>
          )
        }
      />

      {/* 2-Column Responsive Metric KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4 flex items-center justify-between border-primary/20 bg-primary/[0.02]">
          <div className="space-y-1">
            <span className="eyebrow text-xs text-muted-foreground block">
              Total Pelanggan Terdata
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {stats.total}{" "}
              <span className="text-sm font-normal text-muted-foreground">Pelanggan</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span>
                Online: <strong>{stats.online}</strong>
              </span>
              <span>·</span>
              <span>
                Offline: <strong>{stats.offline}</strong>
              </span>
            </div>
          </div>
          <div className="size-12 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Users className="size-6" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="space-y-1">
            <span className="eyebrow text-xs text-muted-foreground block">
              Jersey Dibeli Pelanggan
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {stats.totalJerseysSold}{" "}
              <span className="text-sm font-normal text-muted-foreground">Jersey Terjual</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <TrendingUp className="size-3.5 text-emerald-500" />
              <span>
                Rata-rata: <strong>{stats.avgJerseysPerCustomer} Jersey / Pelanggan</strong>
              </span>
            </div>
          </div>
          <div className="size-12 rounded-xl bg-emerald-500/10 grid place-items-center text-emerald-600 dark:text-emerald-400">
            <Shirt className="size-6" />
          </div>
        </Card>
      </div>

      <Card>
        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-6 pb-4 border-b border-border">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, no. HP, atau kota..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-9 w-full text-xs placeholder:text-xs placeholder:text-muted-foreground/80"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons - Full width symmetric on mobile */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-all cursor-pointer text-center",
                typeFilter === "all"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semua ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("online")}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-all cursor-pointer text-center",
                typeFilter === "online"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Online ({stats.online})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter("offline")}
              className={cn(
                "flex-1 sm:flex-none px-3 py-1.5 sm:py-1 text-xs font-semibold rounded-md transition-all cursor-pointer text-center",
                typeFilter === "offline"
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Offline ({stats.offline})
            </button>
          </div>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
            Memuat data pelanggan & statistik pembelian...
          </p>
        ) : q.isError ? (
          <div className="text-sm text-destructive p-4 border border-destructive/20 bg-destructive/10 rounded-md">
            <p className="font-semibold">Gagal memuat data pelanggan:</p>
            <p className="mt-1 font-mono text-xs">
              {q.error instanceof Error ? q.error.message : String(q.error)}
            </p>
          </div>
        ) : filteredAndSorted.length > 0 ? (
          <>
            {/* Mobile Customer Cards (< lg) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
              {filteredAndSorted.map((p) => {
                const isChecked = selectedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "p-3.5 rounded-xl border border-border bg-card/60 space-y-3 shadow-sm transition-all",
                      isChecked && "border-primary bg-primary/[0.03]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(p.id, e.target.checked)}
                          className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {p.nama_lengkap}
                          </h4>
                          <div className="mt-0.5">
                            {p.type === "online" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded border border-blue-500/20">
                                <Globe className="size-2.5" />
                                Akun Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                                <Store className="size-2.5" />
                                Kasir / Offline
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(p.id)}
                        title="Hapus Pelanggan"
                        className="size-8 rounded-lg border border-destructive/20 text-destructive hover:bg-destructive/10 grid place-items-center cursor-pointer transition-colors shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1 text-xs">
                      {p.email && p.email !== "—" && (
                        <div className="text-muted-foreground font-mono truncate">{p.email}</div>
                      )}
                      {p.no_hp && p.no_hp !== "—" && (
                        <div className="text-foreground font-medium text-[11px]">
                          WA: {p.no_hp}
                        </div>
                      )}
                      {p.kota && p.kota !== "—" && (
                        <div className="text-muted-foreground text-[11px] truncate flex items-center gap-1">
                          <MapPin className="size-3 text-muted-foreground shrink-0" />
                          <span>{p.kota}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Jersey Dibeli</span>
                        <span className="font-extrabold text-foreground flex items-center gap-1">
                          <Shirt className="size-3 text-primary" />
                          {p.totalJerseys} pcs
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {p.totalOrders}x transaksi
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block">Total Belanja</span>
                        <span className="font-extrabold text-sm text-foreground">
                          {formatIDR(p.totalSpent)}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Terakhir: {formatDate(p.lastOrderDate)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= lg) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                    <th className="py-2.5 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer align-middle"
                      />
                    </th>
                    <th
                      className="py-2.5 pr-4 cursor-pointer hover:text-foreground select-none group"
                      onClick={() => handleSort("nama")}
                    >
                      <div className="flex items-center gap-1">
                        Pelanggan
                        {sortField === "nama" ? (
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
                    <th className="py-2.5 pr-4">Kontak (Email / HP)</th>
                    <th className="py-2.5 pr-4">Lokasi</th>
                    <th
                      className="py-2.5 pr-4 cursor-pointer hover:text-foreground select-none group text-center"
                      onClick={() => handleSort("jerseys")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Jersey Dibeli
                        {sortField === "jerseys" ? (
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
                      className="py-2.5 pr-4 cursor-pointer hover:text-foreground select-none group text-right"
                      onClick={() => handleSort("spent")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Belanja
                        {sortField === "spent" ? (
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
                      className="py-2.5 pr-4 cursor-pointer hover:text-foreground select-none group text-right"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Terakhir Beli
                        {sortField === "created_at" ? (
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
                    <th className="py-2.5 pr-3 text-center w-14">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSorted.map((p) => {
                    const isChecked = selectedIds.includes(p.id);
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-border/50 transition-colors ${
                          isChecked ? "bg-primary/5" : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="py-3.5 px-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSelectRow(p.id, e.target.checked)}
                            className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer align-middle"
                          />
                        </td>
                        <td className="py-3.5 pr-4">
                          <div className="font-bold text-xs sm:text-sm text-foreground">
                            {p.nama_lengkap}
                          </div>
                          <div className="mt-0.5">
                            {p.type === "online" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                <Globe className="size-2.5" />
                                Akun Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                <Store className="size-2.5" />
                                Kasir / Offline
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="pr-4 text-xs space-y-0.5">
                          <div className="font-mono text-muted-foreground">{p.email}</div>
                          {p.no_hp && p.no_hp !== "—" && (
                            <div className="text-[11px] font-semibold text-foreground">
                              WA: {p.no_hp}
                            </div>
                          )}
                        </td>
                        <td className="text-xs pr-4 text-muted-foreground">
                          <div className="font-medium text-foreground">{p.kota}</div>
                          <div className="text-[11px] truncate max-w-[140px] text-muted-foreground">
                            {p.alamat}
                          </div>
                        </td>

                        {/* STATISTIK JERSEY DIBELI */}
                        <td className="pr-4 text-center">
                          <div className="inline-flex flex-col items-center justify-center">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black",
                                p.totalJerseys > 0
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Shirt className="size-3" />
                              {p.totalJerseys} Jersey
                            </span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {p.totalOrders}x Transaksi
                            </span>
                          </div>
                        </td>

                        {/* TOTAL BELANJA */}
                        <td className="text-right pr-4 font-bold text-xs sm:text-sm text-foreground">
                          {formatIDR(p.totalSpent)}
                        </td>

                        {/* TANGGAL TERAKHIR BELI */}
                        <td className="text-xs pr-4 text-right text-muted-foreground">
                          {formatDate(p.lastOrderDate)}
                        </td>

                        <td className="py-3.5 pr-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSingle(p.id)}
                            title="Hapus Pelanggan"
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
          <div className="py-12 text-center">
            <UserX className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold">Tidak ada pelanggan ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search
                ? `Tidak ada hasil pencarian untuk "${search}".`
                : "Belum ada transaksi pelanggan terdata di toko Anda."}
            </p>
          </div>
        )}
      </Card>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) setTargetDeleteIds([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Pelanggan</AlertDialogTitle>
            <AlertDialogDescription>
              {targetDeleteIds.length > 1
                ? `Apakah Anda yakin ingin menghapus ${targetDeleteIds.length} data pelanggan terpilih? Tindakan ini tidak dapat dibatalkan.`
                : "Apakah Anda yakin ingin menghapus data pelanggan ini? Tindakan ini tidak dapat dibatalkan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
              onClick={() => deleteMutation.mutate(targetDeleteIds)}
            >
              Hapus Pelanggan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
