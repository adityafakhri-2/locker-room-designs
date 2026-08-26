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
        .select("id, subtotal, discount_amount, status, created_at")
        .in("status", ["paid", "processing", "shipped", "delivered"]);
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

  // 1. Total Jersey Sales (Automated)
  const totalJerseySales = orders.reduce((acc, o) => {
    const revenue = Math.max(0, Number(o.subtotal || 0) - Number(o.discount_amount || 0));
    return acc + revenue;
  }, 0);

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

  // 5. Total Outflow (Operational costs)
  const totalDanaKeluar = manualTxs
    .filter((t) => t.type === "out")
    .reduce((acc, t) => acc + Number(t.amount), 0);

  // 6. Current Cash Balance
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-border border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Saldo Kas Saat Ini
            </span>
            <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate"
            title={formatIDR(saldoKasSaatIni)}
          >
            {formatIDR(saldoKasSaatIni)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total Dana Masuk - Total Dana Keluar</p>
        </Card>

        <Card className="border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Dana Masuk
            </span>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <div
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(totalDanaMasuk)}
          >
            {formatIDR(totalDanaMasuk)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-2">
            <span>Modal: {formatIDR(totalManualInCapital)}</span>
            <span>·</span>
            <span>Jersey: {formatIDR(totalJerseySales)}</span>
          </div>
        </Card>

        <Card className="border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Pengeluaran
            </span>
            <TrendingDown className="size-4 text-rose-500" />
          </div>
          <div
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-2 truncate"
            title={formatIDR(totalDanaKeluar)}
          >
            {formatIDR(totalDanaKeluar)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Biaya sewa, packaging, operasional, dll.</p>
        </Card>
      </div>

      {/* Breakdown Sub-Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="p-4 flex items-center justify-between border-dashed border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-md">
              <ShoppingBag className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Omset Penjualan Jersey</div>
              <div className="font-extrabold text-lg">{formatIDR(totalJerseySales)}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">
            Otomatis (Orders)
          </Badge>
        </Card>

        <Card className="p-4 flex items-center justify-between border-dashed border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-md">
              <Briefcase className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Modal Dagang Disuntik</div>
              <div className="font-extrabold text-lg">{formatIDR(totalManualInCapital)}</div>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
            Manual (Input)
          </Badge>
        </Card>
      </div>

      {/* Chart Panel */}
      <Card className="mb-6">
        <h2 className="font-extrabold text-base mb-4 flex items-center gap-2">
          <Calendar className="size-4 text-muted-foreground" />
          Tren Keuangan 6 Bulan Terakhir
        </h2>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}Jt` : `${v / 1000}rb`)}
              />
              <Tooltip
                formatter={(value) => [formatIDR(Number(value)), ""]}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px", marginTop: "10px" }} />
              <Bar name="Dana Masuk" dataKey="masuk" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar name="Dana Keluar" dataKey="keluar" fill="#f43f5e" radius={[4, 4, 0, 0]} />
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
    </DashboardShell>
  );
}
