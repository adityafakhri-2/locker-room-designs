import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { formatIDR, formatDate, statusLabel } from "@/lib/format";
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown, Plus, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { CreateManualOrderDialog } from "@/components/admin/CreateManualOrderDialog";
import { OrderReceiptModal, OrderReceiptData } from "@/components/commerce/OrderReceiptModal";

export const Route = createFileRoute("/_authenticated/_admin/admin/pesanan/")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  // Manual POS Order & Receipt Modal State
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<OrderReceiptData | null>(
    null,
  );
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  function handleSort(field: string) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  function sortIcon(field: string) {
    if (sortField !== field)
      return (
        <ArrowUpDown className="size-3 text-muted-foreground/30 ml-1.5 opacity-40 group-hover:opacity-100" />
      );
    return sortAsc ? (
      <ArrowUp className="size-3 text-primary ml-1.5" />
    ) : (
      <ArrowDown className="size-3 text-primary ml-1.5" />
    );
  }

  const q = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      await supabase.rpc("check_and_cancel_expired_orders");
      const [ordersRes, profilesRes] = await Promise.all([
        supabase
          .from("orders")
          .select("*, payments(status, bank, payment_type), order_items(*)")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, nama_lengkap"),
      ]);
      if (ordersRes.error) {
        throw new Error(ordersRes.error.message);
      }
      if (profilesRes.error) {
        throw new Error(profilesRes.error.message);
      }
      const orders = ordersRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      return orders.map((o) => ({
        ...o,
        profiles: profileMap.get(o.user_id) || null,
      }));
    },
  });

  const counts = useMemo(() => {
    const list = q.data ?? [];
    const all = list.length;
    let pending = 0;
    let paid = 0;
    let processing = 0;
    let shipped = 0;
    let delivered = 0;
    let cancelled = 0;

    list.forEach((o) => {
      const payment = Array.isArray(o.payments)
        ? o.payments[0]
        : (o.payments as unknown as { status: string } | null);
      const displayStatus =
        o.status === "pending" && payment?.status === "waiting_verification"
          ? "waiting_verification"
          : o.status;

      if (displayStatus === "pending") pending++;
      else if (displayStatus === "waiting_verification" || displayStatus === "paid") paid++;
      else if (displayStatus === "processing") processing++;
      else if (displayStatus === "shipped") shipped++;
      else if (displayStatus === "delivered") delivered++;
      else if (displayStatus === "cancelled") cancelled++;
    });

    return { all, pending, paid, processing, shipped, delivered, cancelled };
  }, [q.data]);

  const filteredAndSortedList = useMemo(() => {
    let list = q.data ? [...q.data] : [];

    // 1. Search filter
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((o) => {
        const profile = o.profiles as {
          nama_lengkap?: string | null;
          email?: string | null;
        } | null;
        return (
          o.order_number.toLowerCase().includes(s) ||
          o.recipient_name.toLowerCase().includes(s) ||
          (profile?.nama_lengkap && profile.nama_lengkap.toLowerCase().includes(s)) ||
          (profile?.email && profile.email.toLowerCase().includes(s))
        );
      });
    }

    // 2. Order status filter (using computed displayStatus)
    if (orderFilter !== "all") {
      list = list.filter((o) => {
        const payment = Array.isArray(o.payments)
          ? o.payments[0]
          : (o.payments as unknown as { status: string } | null);
        const displayStatus =
          o.status === "pending" && payment?.status === "waiting_verification"
            ? "waiting_verification"
            : o.status;

        if (orderFilter === "pending") {
          return displayStatus === "pending";
        }
        if (orderFilter === "paid") {
          return displayStatus === "paid" || displayStatus === "waiting_verification";
        }
        return displayStatus === orderFilter;
      });
    }

    // 3. Payment status filter
    if (paymentFilter !== "all") {
      list = list.filter((o) => {
        const payment = Array.isArray(o.payments)
          ? o.payments[0]
          : (o.payments as unknown as { status: string } | null);
        return payment?.status === paymentFilter;
      });
    }

    // 4. Sort
    list.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortField === "order_number") {
        valA = a.order_number;
        valB = b.order_number;
      } else if (sortField === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      } else if (sortField === "recipient_name") {
        valA = (a.recipient_name || "").toLowerCase();
        valB = (b.recipient_name || "").toLowerCase();
      } else if (sortField === "status") {
        const payA = Array.isArray(a.payments)
          ? a.payments[0]
          : (a.payments as unknown as { status: string } | null);
        const payB = Array.isArray(b.payments)
          ? b.payments[0]
          : (b.payments as unknown as { status: string } | null);
        valA =
          a.status === "pending" && payA?.status === "waiting_verification"
            ? "waiting_verification"
            : a.status;
        valB =
          b.status === "pending" && payB?.status === "waiting_verification"
            ? "waiting_verification"
            : b.status;
      } else if (sortField === "payment_status") {
        const payA = Array.isArray(a.payments)
          ? a.payments[0]
          : (a.payments as unknown as { status: string } | null);
        const payB = Array.isArray(b.payments)
          ? b.payments[0]
          : (b.payments as unknown as { status: string } | null);
        valA = payA?.status || "";
        valB = payB?.status || "";
      } else if (sortField === "grand_total") {
        valA = Number(a.grand_total);
        valB = Number(b.grand_total);
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [q.data, search, orderFilter, paymentFilter, sortField, sortAsc]);

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("orders").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesanan berhasil dihapus");
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err) => {
      toast.error("Gagal menghapus pesanan: " + err.message);
    },
  });

  function handleDeleteSingle(id: string) {
    setDeleteIds([id]);
    setDeleteConfirmStep(1);
    setDeleteConfirmOpen(true);
  }

  function handleDeleteBulk() {
    setDeleteIds(selectedIds);
    setDeleteConfirmStep(1);
    setDeleteConfirmOpen(true);
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked && q.data) {
      setSelectedIds(q.data.map((o) => o.id));
    } else {
      setSelectedIds([]);
    }
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Pesanan"
        title="Manajemen Pesanan"
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPosDialogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 text-xs h-9 shadow-sm"
            >
              <Plus className="size-4" />
              + Catat Transaksi Manual / POS
            </Button>
            {selectedIds.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteBulk}
                disabled={deleteMutation.isPending}
                className="text-xs h-9"
              >
                <Trash2 className="size-4 mr-1.5" /> Hapus Terpilih ({selectedIds.length})
              </Button>
            )}
          </div>
        }
      />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Memuat data pesanan...</p>
        ) : q.isError ? (
          <div className="text-sm text-destructive p-4 border border-destructive/20 bg-destructive/10 rounded-md">
            <p className="font-semibold">Gagal memuat data pesanan:</p>
            <p className="mt-1 font-mono text-xs">
              {q.error instanceof Error ? q.error.message : String(q.error)}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Order Status Tabs */}
            <div className="border-b border-border -mx-5 md:-mx-6 px-5 md:px-6 mb-5 overflow-x-auto scrollbar-none flex gap-6">
              {[
                { value: "all", label: "Semua", count: counts.all },
                { value: "pending", label: "Menunggu Pembayaran", count: counts.pending },
                { value: "paid", label: "Sudah Dibayar", count: counts.paid },
                { value: "processing", label: "Sedang Diproses", count: counts.processing },
                { value: "shipped", label: "Dikirim", count: counts.shipped },
                { value: "delivered", label: "Selesai", count: counts.delivered },
                { value: "cancelled", label: "Dibatalkan", count: counts.cancelled },
              ].map((tab) => {
                const isActive = orderFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setOrderFilter(tab.value)}
                    className={cn(
                      "pb-3 text-sm font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap focus:outline-none",
                      isActive
                        ? "border-primary text-primary font-bold"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full font-bold transition-colors",
                        isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search & Filter Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <Input
                placeholder="Cari nomor order, penerima..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs h-9"
              />

              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="text-xs h-9 cursor-pointer">
                  <SelectValue placeholder="Filter Status Bayar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="cursor-pointer">
                    Semua Status Bayar
                  </SelectItem>
                  {["waiting_payment", "waiting_verification", "approved", "rejected"].map((s) => (
                    <SelectItem key={s} value={s} className="cursor-pointer">
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filteredAndSortedList.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                      <th className="py-2 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            q.data
                              ? selectedIds.length === q.data.length && q.data.length > 0
                              : false
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer"
                        />
                      </th>
                      <th
                        className="py-2 cursor-pointer select-none group"
                        onClick={() => handleSort("order_number")}
                      >
                        <div className="flex items-center">Order {sortIcon("order_number")}</div>
                      </th>
                      <th
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("created_at")}
                      >
                        <div className="flex items-center">Tanggal {sortIcon("created_at")}</div>
                      </th>
                      <th
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("recipient_name")}
                      >
                        <div className="flex items-center">
                          Pelanggan {sortIcon("recipient_name")}
                        </div>
                      </th>
                      <th
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center">Status {sortIcon("status")}</div>
                      </th>
                      <th
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("payment_status")}
                      >
                        <div className="flex items-center">Bayar {sortIcon("payment_status")}</div>
                      </th>
                      <th
                        className="text-right cursor-pointer select-none group"
                        onClick={() => handleSort("grand_total")}
                      >
                        <div className="flex items-center justify-end">
                          Total {sortIcon("grand_total")}
                        </div>
                      </th>
                      <th className="w-12 text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedList.map((o) => {
                      const payment = Array.isArray(o.payments)
                        ? o.payments[0]
                        : (o.payments as unknown as { status: string } | null);
                      const profile = o.profiles as {
                        nama_lengkap?: string | null;
                        email?: string | null;
                      } | null;
                      const isSelected = selectedIds.includes(o.id);

                      const displayStatus =
                        o.status === "pending" && payment?.status === "waiting_verification"
                          ? "waiting_verification"
                          : o.status;

                      // Design status badges
                      // 1. Order Status Badge
                      let orderBadge = (
                        <span className="text-xs text-muted-foreground">
                          {statusLabel(displayStatus)}
                        </span>
                      );
                      if (displayStatus === "pending") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                            Menunggu Pembayaran
                          </span>
                        );
                      } else if (displayStatus === "waiting_verification") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 animate-pulse">
                            Sudah Dibayar (Menunggu Konfirmasi)
                          </span>
                        );
                      } else if (displayStatus === "paid") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            Pembayaran Diterima
                          </span>
                        );
                      } else if (displayStatus === "delivered") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            Selesai
                          </span>
                        );
                      } else if (displayStatus === "processing") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800/50">
                            Sedang Diproses
                          </span>
                        );
                      } else if (displayStatus === "shipped") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                            Dikirim
                          </span>
                        );
                      } else if (displayStatus === "cancelled") {
                        orderBadge = (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                            Dibatalkan
                          </span>
                        );
                      }

                      // 2. Payment Status Badge
                      let payBadge = <span className="text-xs text-muted-foreground">—</span>;
                      if (payment) {
                        if (payment.status === "waiting_payment") {
                          payBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Menunggu Pembayaran
                            </span>
                          );
                        } else if (payment.status === "waiting_verification") {
                          payBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 animate-pulse">
                              Sudah Dibayar (Menunggu Konfirmasi)
                            </span>
                          );
                        } else if (payment.status === "approved" || payment.status === "paid") {
                          payBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                              Disetujui
                            </span>
                          );
                        } else if (payment.status === "rejected") {
                          payBadge = (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                              Ditolak
                            </span>
                          );
                        }
                      }

                      return (
                        <tr
                          key={o.id}
                          className="border-b border-border/50 hover:bg-muted/10 transition-colors"
                        >
                          <td className="py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleSelectRow(o.id, e.target.checked)}
                              className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer"
                            />
                          </td>
                          <td className="py-3">
                            <Link
                              to="/admin/pesanan/$orderNumber"
                              params={{ orderNumber: o.order_number }}
                              className="font-mono text-xs text-primary hover:underline cursor-pointer"
                            >
                              {o.order_number}
                            </Link>
                          </td>
                          <td className="text-xs">{formatDate(o.created_at)}</td>
                          <td className="text-xs">
                            {profile?.nama_lengkap || profile?.email || "—"}
                          </td>
                          <td className="py-2">{orderBadge}</td>
                          <td className="py-2">{payBadge}</td>
                          <td className="text-right tabular-nums font-semibold">
                            {formatIDR(o.grand_total)}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForReceipt(o as any);
                                  setReceiptModalOpen(true);
                                }}
                                className="p-1.5 rounded hover:bg-primary/10 text-primary hover:text-primary transition-colors cursor-pointer"
                                title="Cetak Struk / Download Invoice"
                              >
                                <Printer className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(o.id)}
                                className="p-1.5 rounded hover:bg-destructive/10 text-destructive hover:opacity-70 transition-opacity cursor-pointer"
                                disabled={deleteMutation.isPending}
                                title="Hapus Pesanan"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Tidak ada pesanan masuk yang cocok dengan kriteria pencarian / filter.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Dialog Catat Transaksi Manual / POS */}
      <CreateManualOrderDialog
        isOpen={posDialogOpen}
        onClose={() => setPosDialogOpen(false)}
      />

      {/* Modal Cetak Struk & Invoice */}
      <OrderReceiptModal
        order={selectedOrderForReceipt}
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setSelectedOrderForReceipt(null);
        }}
      />

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) {
            setTimeout(() => setDeleteConfirmStep(1), 150);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmStep === 1
                ? "Peringatan Tahap 1: Konfirmasi Hapus Pesanan"
                : "Peringatan Tahap 2: TINDAKAN SENSITIF & PERMANEN"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmStep === 1 ? (
                deleteIds.length > 1
                  ? `Apakah Anda yakin ingin menghapus ${deleteIds.length} pesanan terpilih beserta seluruh data terkait pembayaran dan pengiriman? Lanjutkan ke verifikasi akhir?`
                  : "Apakah Anda yakin ingin menghapus pesanan ini beserta seluruh data terkait pembayaran dan pengiriman? Lanjutkan ke verifikasi akhir?"
              ) : (
                "PERINGATAN AKHIR: Menghapus pesanan ini akan secara otomatis mengembalikan stok produk yang bersangkutan ke dalam inventaris toko dan mengurangi jumlah produk terjual di laporan penjualan. Data yang dihapus tidak dapat dipulihkan. Apakah Anda benar-benar yakin?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmStep(1)}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={(e) => {
                if (deleteConfirmStep === 1) {
                  e.preventDefault();
                  setDeleteConfirmStep(2);
                } else {
                  deleteMutation.mutate(deleteIds);
                  setDeleteConfirmOpen(false);
                }
              }}
            >
              {deleteConfirmStep === 1 ? "Lanjut" : "Ya, Hapus Permanen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
