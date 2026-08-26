import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIDR, formatDate } from "@/lib/format";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Wallet,
  ShoppingBag,
  Briefcase,
  Calendar as CalendarIcon,
  ChevronsUpDown,
  Coins,
  ArrowUpRight,
  Search,
  FileText,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
export const Route = createFileRoute("/_authenticated/_admin/admin/keuangan")({
  component: AdminKeuangan,
});

const CATEGORY_LABELS: Record<string, string> = {
  modal: "Modal Dagang",
  pendapatan_lain: "Pendapatan Lain-lain",
  sewa_lapak: "Sewa Lapak",
  packaging: "Packaging",
  operasional: "Operasional Pendukung",
  marketing: "Marketing / Iklan",
  pengadaan_barang: "Pengadaan Jersey/Stok",
  lainnya: "Pengeluaran Lainnya",
  penjualan: "Penjualan Jersey (Otomatis)",
};

function formatThousand(val: string | number): string {
  const clean = String(val).replace(/\D/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("id-ID");
}

function AdminKeuangan() {
  const qc = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Drilldown Detail Modal State
  type DetailModalType =
    | "saldo"
    | "dana_masuk"
    | "operasional"
    | "modal_jersey"
    | "omset_jersey"
    | "modal_disuntik"
    | null;
  const [detailModalType, setDetailModalType] = useState<DetailModalType>(null);
  const [modalSearch, setModalSearch] = useState("");

  // Form State
  const [txDate, setTxDate] = useState(new Date().toISOString().split("T")[0]);
  const [txType, setTxType] = useState<"in" | "out">("out");
  const [txCategory, setTxCategory] = useState("");
  const [txAmountStr, setTxAmountStr] = useState("");
  const [txDescription, setTxDescription] = useState("");

  // Filters State
  const [filterType, setFilterType] = useState<"all" | "in" | "out">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Query 1: Manual Transactions
  const txQuery = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query 2: Jersey Orders (Paid/Completed)
  const ordersQuery = useQuery({
    queryKey: ["financial-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, 
          order_number,
          recipient_name,
          subtotal, 
          discount_amount, 
          grand_total,
          status, 
          created_at,
          order_items (
            product_name,
            quantity,
            unit_price,
            cost_price
          )
        `)
        .in("status", ["paid", "processing", "shipped", "delivered"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Query 3: Products (for Total Modal HPP Inventaris)
  const productsQuery = useQuery({
    queryKey: ["financial-products-hpp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, team, cost_price, price, stock, size_stock")
        .order("stock", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Mutation: Add Transaction
  const addMutation = useMutation({
    mutationFn: async (newTx: {
      transaction_date: string;
      type: "in" | "out";
      category: string;
      amount: number;
      description: string | null;
    }) => {
      const { error } = await supabase.from("financial_transactions").insert(newTx);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaksi keuangan berhasil ditambahkan");
      setIsDialogOpen(false);
      // Reset Form
      setTxDate(new Date().toISOString().split("T")[0]);
      setTxType("out");
      setTxCategory("");
      setTxAmountStr("");
      setTxDescription("");
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Mutation: Delete Transaction
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaksi berhasil dihapus");
      qc.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Calculations
  const orders = ordersQuery.data ?? [];
  const manualTxs = txQuery.data ?? [];
  const products = productsQuery.data ?? [];

  // 1. Total Jersey Sales (Automated)
  const totalJerseySales = orders.reduce((acc, o) => {
    const revenue = Math.max(0, Number(o.subtotal || 0) - Number(o.discount_amount || 0));
    return acc + revenue;
  }, 0);

  // 1b. Total Modal Jersey (HPP Inventaris Keseluruhan seperti di menu Produk)
  const totalModalHpp = products.reduce((sum, p) => {
    const cost = Number(p.cost_price ?? 0);
    const qty = Number(p.stock ?? 0);
    return sum + cost * qty;
  }, 0);
  const totalStockPcs = products.reduce((sum, p) => sum + (Number(p.stock ?? 0) || 0), 0);

  // 2. Total Injected Capital (Inflows categorized as modal)
  const totalManualInCapital = manualTxs
    .filter((t) => t.type === "in" && t.category === "modal")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // 3. Other manual inflows
  const totalManualInOther = manualTxs
    .filter((t) => t.type === "in" && t.category !== "modal")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // 4. Total Inflow (Jersey Sales + Capital + Inflows)
  const totalDanaMasuk = totalJerseySales + totalManualInCapital + totalManualInOther;

  // 5. Total Pengeluaran Operasional (Sewa, Packaging, Operasional, dll.)
  const totalPengeluaranOperasional = manualTxs
    .filter((t) => t.type === "out")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // 6. Total Pengeluaran Keseluruhan (Operasional + Modal Jersey HPP)
  const totalDanaKeluar = totalPengeluaranOperasional + totalModalHpp;

  // 7. Current Cash Balance
  const saldoKasSaatIni = totalDanaMasuk - totalDanaKeluar;

  // Chart aggregation by month (Last 6 Months)
  const monthlyDataMap: Record<string, { month: string; masuk: number; keluar: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    monthlyDataMap[monthKey] = { month: monthKey, masuk: 0, keluar: 0 };
  }

  // Populate from manual transactions
  manualTxs.forEach((t) => {
    const date = new Date(t.transaction_date);
    const monthKey = date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    if (monthlyDataMap[monthKey]) {
      if (t.type === "in") {
        monthlyDataMap[monthKey].masuk += Number(t.amount);
      } else {
        monthlyDataMap[monthKey].keluar += Number(t.amount);
      }
    }
  });

  // Populate from orders
  orders.forEach((o) => {
    const date = new Date(o.created_at);
    const monthKey = date.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    if (monthlyDataMap[monthKey]) {
      const revenue = Math.max(0, Number(o.subtotal || 0) - Number(o.discount_amount || 0));
      monthlyDataMap[monthKey].masuk += revenue;

      // Add sold jersey cost to monthly outflows
      const items = (o as any).order_items || [];
      const orderCost = items.reduce(
        (sum: number, item: any) => sum + Number(item.cost_price || 0) * Number(item.quantity || 1),
        0
      );
      monthlyDataMap[monthKey].keluar += orderCost;
    }
  });

  const chartData = Object.values(monthlyDataMap);

  // Filtered transactions for the table
  const filteredTxs = manualTxs.filter((t) => {
    const matchesType = filterType === "all" || t.type === filterType;
    const matchesCategory = filterCategory === "all" || t.category === filterCategory;
    return matchesType && matchesCategory;
  });

  // Form submission handler
  const handleAddTransaction = () => {
    const amt = Number(txAmountStr.replace(/\D/g, "")) || 0;
    if (!txCategory) {
      toast.error("Silakan pilih kategori transaksi");
      return;
    }
    if (amt <= 0) {
      toast.error("Nominal transaksi harus lebih dari Rp 0");
      return;
    }

    addMutation.mutate({
      transaction_date: txDate,
      type: txType,
      category: txCategory,
      amount: amt,
      description: txDescription || null,
    });
  };

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Keuangan & Modal"
        title="Manajemen Keuangan"
        action={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="cursor-pointer">
                <Plus className="size-4 mr-2" />
                Catat Transaksi
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Tambah Catatan Keuangan</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Tanggal Transaksi</Label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-left font-normal text-xs bg-background border-input cursor-pointer h-10 animate-fade-in"
                      >
                        <span className="flex items-center gap-2">
                          <CalendarIcon className="size-4 text-primary" />
                          {txDate
                            ? new Date(txDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "Pilih Tanggal"}
                        </span>
                        <ChevronsUpDown className="size-3 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 z-[100] bg-popover border border-border shadow-xl rounded-xl"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        selected={txDate ? new Date(txDate) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const offset = date.getTimezoneOffset();
                            const localDate = new Date(date.getTime() - (offset * 60 * 1000));
                            setTxDate(localDate.toISOString().split("T")[0]);
                            setDatePickerOpen(false);
                          }
                        }}
                        initialFocus
                        className="rounded-lg border-0"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="type">Tipe Transaksi</Label>
                  <Select
                    value={txType}
                    onValueChange={(val: "in" | "out") => {
                      setTxType(val);
                      setTxCategory(""); // Reset category when switching type
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="out">Dana Keluar (Beban / Biaya)</SelectItem>
                      <SelectItem value="in">Dana Masuk (Modal / Pendapatan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select value={txCategory} onValueChange={setTxCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {txType === "in" ? (
                        <>
                          <SelectItem value="modal">Modal Dagang (Capital Inbound)</SelectItem>
                          <SelectItem value="pendapatan_lain">Pendapatan Lain-lain</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="sewa_lapak">Sewa Lapak</SelectItem>
                          <SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="operasional">Operasional Pendukung</SelectItem>
                          <SelectItem value="marketing">Marketing / Iklan</SelectItem>
                          <SelectItem value="pengadaan_barang">Pengadaan Jersey/Stok</SelectItem>
                          <SelectItem value="lainnya">Pengeluaran Lainnya</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="amount">Nominal (Rupiah)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">
                      Rp
                    </span>
                    <Input
                      id="amount"
                      placeholder="0"
                      className="pl-9"
                      value={txAmountStr}
                      onChange={(e) => setTxAmountStr(formatThousand(e.target.value))}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="desc">Keterangan / Catatan</Label>
                  <Input
                    id="desc"
                    placeholder="cth. Bayar sewa lapak Agustus, Beli Bubble Wrap"
                    value={txDescription}
                    onChange={(e) => setTxDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddTransaction}
                  disabled={addMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {addMutation.isPending ? "Menyimpan..." : "Simpan Transaksi"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card
          onClick={() => {
            setDetailModalType("saldo");
            setModalSearch("");
          }}
          className="border-border border-emerald-500/30 bg-emerald-500/[0.03] cursor-pointer hover:border-emerald-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              Saldo Kas Saat Ini
            </span>
            <div className="flex items-center gap-1">
              <Wallet className="size-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <ArrowUpRight className="size-3.5 text-emerald-600/60 dark:text-emerald-400/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div
            className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate"
            title={formatIDR(saldoKasSaatIni)}
          >
            {formatIDR(saldoKasSaatIni)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground">Dana Masuk - Total Pengeluaran</p>
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Lihat Detail ↗
            </span>
          </div>
        </Card>

        <Card
          onClick={() => {
            setDetailModalType("dana_masuk");
            setModalSearch("");
          }}
          className="border-border cursor-pointer hover:border-primary hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Dana Masuk
            </span>
            <div className="flex items-center gap-1">
              <TrendingUp className="size-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              <ArrowUpRight className="size-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div
            className="text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(totalDanaMasuk)}
          >
            {formatIDR(totalDanaMasuk)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-1.5">
              <span>Modal: {formatIDR(totalManualInCapital)}</span>
              <span>·</span>
              <span>Jersey: {formatIDR(totalJerseySales)}</span>
            </div>
            <span className="text-[10px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Lihat Detail ↗
            </span>
          </div>
        </Card>

        <Card
          onClick={() => {
            setDetailModalType("operasional");
            setModalSearch("");
          }}
          className="border-border cursor-pointer hover:border-rose-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pengeluaran Operasional
            </span>
            <div className="flex items-center gap-1">
              <TrendingDown className="size-4 text-rose-500 group-hover:scale-110 transition-transform" />
              <ArrowUpRight className="size-3.5 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div
            className="text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(totalPengeluaranOperasional)}
          >
            {formatIDR(totalPengeluaranOperasional)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground">Sewa, packaging, operasional, dll.</p>
            <span className="text-[10px] font-semibold text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Lihat Detail ↗
            </span>
          </div>
        </Card>

        <Card
          onClick={() => {
            setDetailModalType("modal_jersey");
            setModalSearch("");
          }}
          className="border-border cursor-pointer hover:border-amber-500 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Modal Jersey (HPP)
            </span>
            <div className="flex items-center gap-1">
              <Coins className="size-4 text-amber-500 group-hover:scale-110 transition-transform" />
              <ArrowUpRight className="size-3.5 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div
            className="text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(totalModalHpp)}
          >
            {formatIDR(totalModalHpp)}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[11px] text-muted-foreground">
              Dari <span className="font-bold text-foreground">{totalStockPcs} pcs</span> stok jersey
            </p>
            <span className="text-[10px] font-semibold text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Lihat Detail ↗
            </span>
          </div>
        </Card>
      </div>

      {/* Breakdown Sub-Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card
          onClick={() => {
            setDetailModalType("omset_jersey");
            setModalSearch("");
          }}
          className="p-4 flex items-center justify-between border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary hover:bg-primary/[0.03] hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-md group-hover:scale-105 transition-transform">
              <ShoppingBag className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>Omset Penjualan Jersey</span>
                <ArrowUpRight className="size-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="font-extrabold text-lg">{formatIDR(totalJerseySales)}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            Otomatis (Orders) ↗
          </Badge>
        </Card>

        <Card
          onClick={() => {
            setDetailModalType("modal_disuntik");
            setModalSearch("");
          }}
          className="p-4 flex items-center justify-between border-dashed border-border bg-muted/20 cursor-pointer hover:border-amber-500 hover:bg-amber-500/[0.03] hover:shadow-md transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-md group-hover:scale-105 transition-transform">
              <Briefcase className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span>Modal Dagang Disuntik</span>
                <ArrowUpRight className="size-3 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="font-extrabold text-lg">{formatIDR(totalManualInCapital)}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
            Manual (Input) ↗
          </Badge>
        </Card>
      </div>

      {/* Chart Panel */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <h2 className="font-extrabold text-base flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" />
            Tren Keuangan 6 Bulan Terakhir
          </h2>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-emerald-500" /> Dana Masuk
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2.5 rounded-full bg-rose-500" /> Dana Keluar
            </span>
          </div>
        </div>
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "currentColor", fontSize: 12, opacity: 0.6 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "currentColor", fontSize: 11, opacity: 0.6 }}
                tickFormatter={(v) =>
                  v === 0 ? "0" : v >= 1000000 ? `${(v / 1000000).toFixed(0)} Jt` : `${v / 1000} rb`
                }
              />
              <Tooltip
                formatter={(value: any, name: any) => [formatIDR(Number(value || 0)), name]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                }}
                labelStyle={{ fontWeight: "bold", marginBottom: "4px", color: "hsl(var(--foreground))" }}
              />
              <Bar name="Dana Masuk" dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={42} />
              <Bar name="Dana Keluar" dataKey="keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* History Transactions Table & Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
          <h2 className="font-extrabold text-base">Riwayat Transaksi Manual</h2>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Filter Tipe */}
            <Select value={filterType} onValueChange={(val: any) => setFilterType(val)}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="in">Dana Masuk</SelectItem>
                <SelectItem value="out">Dana Keluar</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Kategori */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                <SelectItem value="modal">Modal Dagang</SelectItem>
                <SelectItem value="sewa_lapak">Sewa Lapak</SelectItem>
                <SelectItem value="packaging">Packaging</SelectItem>
                <SelectItem value="operasional">Operasional</SelectItem>
                <SelectItem value="marketing">Marketing / Iklan</SelectItem>
                <SelectItem value="pengadaan_barang">Pengadaan Jersey</SelectItem>
                <SelectItem value="pendapatan_lain">Pendapatan Lain</SelectItem>
                <SelectItem value="lainnya">Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {txQuery.isLoading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Memuat data...</div>
        ) : filteredTxs.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Tidak ada transaksi manual ditemukan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead className="w-[100px]">Tipe</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="w-[80px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTxs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium text-xs whitespace-nowrap">
                      {formatDate(t.transaction_date)}
                    </TableCell>
                    <TableCell>
                      {t.type === "in" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 border-0 text-[10px] px-2 py-0.5 rounded">
                          Masuk
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15 border-0 text-[10px] px-2 py-0.5 rounded">
                          Keluar
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={t.description ?? ""}>
                      {t.description || "—"}
                    </TableCell>
                    <TableCell className="text-right font-extrabold text-xs">
                      <span className={t.type === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {t.type === "in" ? "+" : "-"} {formatIDR(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini?")) {
                            deleteMutation.mutate(t.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Drilldown Detail Modal Dialog */}
      <Dialog
        open={detailModalType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModalType(null);
            setModalSearch("");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
              <FileText className="size-3.5" />
              Perincian Transaksi & Arus Keuangan
            </div>
            <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-between">
              {detailModalType === "saldo" && "Audit Perincian Saldo Kas Saat Ini"}
              {detailModalType === "dana_masuk" && "Perincian Total Dana Masuk"}
              {detailModalType === "operasional" && "Perincian Pengeluaran Operasional"}
              {detailModalType === "modal_jersey" && "Perincian Total Modal Jersey (HPP Inventaris)"}
              {detailModalType === "omset_jersey" && "Perincian Omset Penjualan Jersey (Pesanan)"}
              {detailModalType === "modal_disuntik" && "Perincian Modal Dagang Disuntik"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {detailModalType === "saldo" &&
                "Rekapitulasi lengkap sumber dana masuk dan seluruh komponen pengeluaran modal & beban operasional."}
              {detailModalType === "dana_masuk" &&
                "Daftar lengkap dana masuk yang bersumber dari modal disuntik manual dan omset pesanan jersey pelanggan."}
              {detailModalType === "operasional" &&
                "Daftar transaksi pengeluaran operasional manual (sewa lapak, packaging, marketing, dll.)."}
              {detailModalType === "modal_jersey" &&
                "Rincian modal (HPP) seluruh stok jersey toko yang saat ini tersedia di gudang inventaris."}
              {detailModalType === "omset_jersey" &&
                "Daftar seluruh pesanan jersey yang telah dibayar oleh pelanggan beserta nilai transaksi bersihnya."}
              {detailModalType === "modal_disuntik" &&
                "Riwayat catatan penambahan modal dagang (capital inbound) ke dalam kas toko."}
            </DialogDescription>
          </DialogHeader>

          {/* Search bar inside modal (except for saldo overview) */}
          {detailModalType !== "saldo" && (
            <div className="px-6 py-3 border-b border-border bg-muted/10 flex items-center gap-3">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <Input
                placeholder={
                  detailModalType === "modal_jersey"
                    ? "Cari nama jersey atau klub..."
                    : detailModalType === "omset_jersey"
                    ? "Cari no. pesanan atau nama pemesan..."
                    : "Cari transaksi, kategori, atau catatan..."
                }
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="h-8 text-xs bg-background border-border/80"
              />
              {modalSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalSearch("")}
                  className="h-8 px-2 text-xs"
                >
                  Reset
                </Button>
              )}
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* 1. Modal: SALDO KAS */}
            {detailModalType === "saldo" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">Total Dana Masuk (+)</span>
                    <span className="text-xl font-extrabold text-foreground mt-1 block">{formatIDR(totalDanaMasuk)}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 block">Total Pengeluaran (-)</span>
                    <span className="text-xl font-extrabold text-foreground mt-1 block">{formatIDR(totalDanaKeluar)}</span>
                  </div>
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                    <span className="text-xs font-semibold text-primary block">Saldo Kas Bersih</span>
                    <span className="text-xl font-extrabold text-primary mt-1 block">{formatIDR(saldoKasSaatIni)}</span>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-bold">Arus Kas</TableHead>
                      <TableHead className="font-bold">Komponen / Sumber Dana</TableHead>
                      <TableHead className="font-bold">Jumlah Data</TableHead>
                      <TableHead className="text-right font-bold">Total Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                          Dana Masuk (+)
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        Modal Dagang Disuntik
                        <span className="block text-xs text-muted-foreground">Catatan suntikan dana manual</span>
                      </TableCell>
                      <TableCell>{manualTxs.filter((t) => t.type === "in" && t.category === "modal").length} Transaksi</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        + {formatIDR(totalManualInCapital)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell>
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                          Dana Masuk (+)
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        Omset Penjualan Jersey
                        <span className="block text-xs text-muted-foreground">Penjualan pesanan berstatus sukses</span>
                      </TableCell>
                      <TableCell>{orders.length} Pesanan</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                        + {formatIDR(totalJerseySales)}
                      </TableCell>
                    </TableRow>

                    {totalManualInOther > 0 && (
                      <TableRow>
                        <TableCell>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-0">
                            Dana Masuk (+)
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          Pendapatan Lain-lain
                          <span className="block text-xs text-muted-foreground">Pemasukan non-modal / order</span>
                        </TableCell>
                        <TableCell>{manualTxs.filter((t) => t.type === "in" && t.category !== "modal").length} Transaksi</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                          + {formatIDR(totalManualInOther)}
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow>
                      <TableCell>
                        <Badge variant="destructive" className="bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border-0">
                          Dana Keluar (-)
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        Pengeluaran Beban Operasional
                        <span className="block text-xs text-muted-foreground">Sewa lapak, packaging, marketing, operasional</span>
                      </TableCell>
                      <TableCell>{manualTxs.filter((t) => t.type === "out").length} Transaksi</TableCell>
                      <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                        - {formatIDR(totalPengeluaranOperasional)}
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell>
                        <Badge variant="destructive" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-0">
                          Dana Keluar (-)
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        Total Modal Jersey (HPP)
                        <span className="block text-xs text-muted-foreground">Modal pengadaan seluruh stok jersey</span>
                      </TableCell>
                      <TableCell>{totalStockPcs} Pcs ({products.length} Produk)</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                        - {formatIDR(totalModalHpp)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* 2. Modal: TOTAL DANA MASUK */}
            {detailModalType === "dana_masuk" && (() => {
              const allInflows = [
                ...orders.map((o) => ({
                  id: `order-${o.id}`,
                  date: o.created_at,
                  type: "Pesanan Jersey",
                  ref: o.order_number || "-",
                  desc: `Pemesan: ${o.recipient_name || "Pelanggan"} (${(o as any).order_items?.length || 0} item)`,
                  amount: Math.max(0, Number(o.subtotal || 0) - Number(o.discount_amount || 0)),
                })),
                ...manualTxs
                  .filter((t) => t.type === "in")
                  .map((t) => ({
                    id: `manual-${t.id}`,
                    date: t.transaction_date,
                    type: CATEGORY_LABELS[t.category] || "Dana Masuk",
                    ref: "Manual",
                    desc: t.description || "-",
                    amount: Number(t.amount || 0),
                  })),
              ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

              const filtered = allInflows.filter(
                (item) =>
                  item.ref.toLowerCase().includes(modalSearch.toLowerCase()) ||
                  item.desc.toLowerCase().includes(modalSearch.toLowerCase()) ||
                  item.type.toLowerCase().includes(modalSearch.toLowerCase())
              );

              return (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold">Tanggal</TableHead>
                        <TableHead className="font-bold">Tipe Sumber</TableHead>
                        <TableHead className="font-bold">No. Ref / Pesanan</TableHead>
                        <TableHead className="font-bold">Keterangan</TableHead>
                        <TableHead className="text-right font-bold">Nominal Masuk</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Tidak ada data dana masuk yang sesuai pencarian.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatDate(item.date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold">
                                {item.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-semibold">{item.ref}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{item.desc}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                              + {formatIDR(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}

            {/* 3. Modal: PENGELUARAN OPERASIONAL */}
            {detailModalType === "operasional" && (() => {
              const outTxs = manualTxs
                .filter((t) => t.type === "out")
                .filter(
                  (t) =>
                    (CATEGORY_LABELS[t.category] || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
                    (t.description || "").toLowerCase().includes(modalSearch.toLowerCase())
                );

              return (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold">Tanggal</TableHead>
                        <TableHead className="font-bold">Kategori Beban</TableHead>
                        <TableHead className="font-bold">Deskripsi Catatan</TableHead>
                        <TableHead className="text-right font-bold">Nominal Pengeluaran</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outTxs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Tidak ada data pengeluaran operasional yang sesuai.
                          </TableCell>
                        </TableRow>
                      ) : (
                        outTxs.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatDate(t.transaction_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold text-rose-600 border-rose-500/20 bg-rose-500/5">
                                {CATEGORY_LABELS[t.category] || t.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{t.description || "-"}</TableCell>
                            <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">
                              - {formatIDR(t.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}

            {/* 4. Modal: TOTAL MODAL JERSEY (HPP) */}
            {detailModalType === "modal_jersey" && (() => {
              const filteredProducts = products.filter(
                (p) =>
                  p.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
                  (p.team || "").toLowerCase().includes(modalSearch.toLowerCase())
              );

              return (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold">Nama Produk Jersey</TableHead>
                        <TableHead className="font-bold">Klub / Tim</TableHead>
                        <TableHead className="text-center font-bold">Stok (Pcs)</TableHead>
                        <TableHead className="text-right font-bold">Modal Satuan (HPP)</TableHead>
                        <TableHead className="text-right font-bold">Total Modal (HPP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Tidak ada produk jersey yang sesuai pencarian.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map((p) => {
                          const cost = Number(p.cost_price ?? 0);
                          const qty = Number(p.stock ?? 0);
                          const subtotalCost = cost * qty;
                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium text-xs max-w-xs truncate">{p.name}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{p.team || "-"}</TableCell>
                              <TableCell className="text-center font-bold text-xs">{qty} pcs</TableCell>
                              <TableCell className="text-right text-xs font-mono">{formatIDR(cost)}</TableCell>
                              <TableCell className="text-right font-bold text-xs text-amber-600 dark:text-amber-400">
                                {formatIDR(subtotalCost)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}

            {/* 5. Modal: OMSET PENJUALAN JERSEY */}
            {detailModalType === "omset_jersey" && (() => {
              const filteredOrders = orders.filter(
                (o) =>
                  (o.order_number || "").toLowerCase().includes(modalSearch.toLowerCase()) ||
                  (o.recipient_name || "").toLowerCase().includes(modalSearch.toLowerCase())
              );

              return (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold">Tanggal</TableHead>
                        <TableHead className="font-bold">No. Pesanan</TableHead>
                        <TableHead className="font-bold">Pemesan</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="text-right font-bold">Subtotal</TableHead>
                        <TableHead className="text-right font-bold">Diskon</TableHead>
                        <TableHead className="text-right font-bold">Omset Bersih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Tidak ada pesanan yang sesuai pencarian.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((o) => {
                          const netRevenue = Math.max(0, Number(o.subtotal || 0) - Number(o.discount_amount || 0));
                          return (
                            <TableRow key={o.id}>
                              <TableCell className="text-xs whitespace-nowrap">{formatDate(o.created_at)}</TableCell>
                              <TableCell className="font-mono text-xs font-bold text-primary">{o.order_number}</TableCell>
                              <TableCell className="text-xs">{o.recipient_name || "Pelanggan"}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-500/10 border-0">
                                  {o.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">{formatIDR(o.subtotal || 0)}</TableCell>
                              <TableCell className="text-right text-xs text-rose-500">
                                {Number(o.discount_amount) > 0 ? `- ${formatIDR(o.discount_amount)}` : "Rp 0"}
                              </TableCell>
                              <TableCell className="text-right font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                {formatIDR(netRevenue)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}

            {/* 6. Modal: MODAL DAGANG DISUNTIK */}
            {detailModalType === "modal_disuntik" && (() => {
              const modalTxs = manualTxs
                .filter((t) => t.type === "in" && t.category === "modal")
                .filter((t) => (t.description || "").toLowerCase().includes(modalSearch.toLowerCase()));

              return (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold">Tanggal</TableHead>
                        <TableHead className="font-bold">Kategori</TableHead>
                        <TableHead className="font-bold">Deskripsi Catatan</TableHead>
                        <TableHead className="text-right font-bold">Nominal Disuntik</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {modalTxs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Belum ada catatan suntik modal dagang.
                          </TableCell>
                        </TableRow>
                      ) : (
                        modalTxs.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-xs whitespace-nowrap">{formatDate(t.transaction_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 border-0">
                                Modal Dagang
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{t.description || "-"}</TableCell>
                            <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                              + {formatIDR(t.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </div>

          {/* Modal Footer */}
          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex sm:justify-between items-center">
            <div className="text-xs text-muted-foreground font-medium">
              {detailModalType === "saldo" && `Total Saldo Kas: ${formatIDR(saldoKasSaatIni)}`}
              {detailModalType === "dana_masuk" && `Total Dana Masuk: ${formatIDR(totalDanaMasuk)}`}
              {detailModalType === "operasional" && `Total Beban Operasional: ${formatIDR(totalPengeluaranOperasional)}`}
              {detailModalType === "modal_jersey" && `Total Modal Stok (${totalStockPcs} pcs): ${formatIDR(totalModalHpp)}`}
              {detailModalType === "omset_jersey" && `Total Omset (${orders.length} pesanan): ${formatIDR(totalJerseySales)}`}
              {detailModalType === "modal_disuntik" && `Total Modal Masuk: ${formatIDR(totalManualInCapital)}`}
            </div>
            <Button variant="outline" size="sm" onClick={() => setDetailModalType(null)} className="text-xs">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
