import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  Wand2,
  Download,
  Save,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Printer,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Coins,
  PackageCheck,
  ShoppingBag,
  Users,
  Info,
  Layers,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { analyzeSalesData } from "@/lib/api/ai.functions";
import {
  generateProductProfitPDF,
  generateMonthlyProfitPDF,
  generateOrdersReportPDF,
  generateAIReportPDF,
} from "@/lib/reportPdfGenerator";

export const Route = createFileRoute("/_authenticated/_admin/admin/laporan")({
  component: AdminReports,
});

function AdminReports() {
  const orders = useQuery({
    queryKey: ["report-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, payments(status, bank, method), order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const products = useQuery({
    queryKey: ["report-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, team, stock, price, cost_price, size_stock");
      if (error) throw error;
      return data ?? [];
    },
  });
  const customers = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () =>
      (await supabase.from("profiles").select("email, nama_lengkap, kota, created_at")).data ?? [],
  });

  const validOrders = (orders.data ?? []).filter((o) =>
    ["paid", "processing", "shipped", "delivered"].includes(o.status),
  );
  const totalRevenue = validOrders.reduce(
    (s, o) => s + Math.max(0, Number(o.subtotal || o.grand_total) - Number((o as any).discount_amount || 0)),
    0,
  );

  // Map product cost lookup with size-specific costs
  const productCostMap: Record<
    string,
    { defaultCost: number; sizeCost: Record<string, number> }
  > = {};
  (products.data ?? []).forEach((p) => {
    const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
    const sizeCostMap = rawStock["_cost_prices"] || (p as any).size_cost_price || {};
    const info = {
      defaultCost: Number((p as any).cost_price ?? 0),
      sizeCost: sizeCostMap,
    };
    productCostMap[p.id] = info;
    if (p.name) {
      productCostMap[p.name] = info;
    }
  });

  // Calculate total COGS, items sold, and per-product sales metrics from actual order items
  let totalCost = 0;
  let totalItemsSold = 0;
  const productSalesMap: Record<
    string,
    { soldCount: number; totalOmset: number; totalModal: number; sizesSold: Record<string, number> }
  > = {};

  validOrders.forEach((o) => {
    const items = (o as any).order_items || [];
    const orderDiscount = Number((o as any).discount_amount) || 0;

    // Hitung subtotal kotor item pada order ini untuk dasar pembagian diskon proporsional
    const orderItemsGrossSubtotal = items.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity) || 1;
      const unitSell = Number(it.unit_price) || 0;
      return sum + (Number(it.subtotal) || unitSell * qty);
    }, 0);

    items.forEach((item: any) => {
      const qty = Number(item.quantity) || 1;
      const key = item.product_id || item.product_name;

      if (!productSalesMap[key]) {
        productSalesMap[key] = { soldCount: 0, totalOmset: 0, totalModal: 0, sizesSold: {} };
      }

      const prodInfo = productCostMap[item.product_id] || productCostMap[item.product_name];
      const itemSizeCost = item.size && prodInfo?.sizeCost?.[item.size];
      const unitCost =
        Number(item.cost_price) > 0
          ? Number(item.cost_price)
          : itemSizeCost !== undefined && Number(itemSizeCost) > 0
            ? Number(itemSizeCost)
            : prodInfo?.defaultCost || 0;

      const unitSell = Number(item.unit_price) || 0;
      const rawItemSubtotal = Number(item.subtotal) || unitSell * qty;
      const itemCost = unitCost * qty;

      // Alokasi diskon proporsional (Pro-Rata):
      // Jika beli 1 jersey -> 100% diskon dialokasikan ke jersey tersebut
      // Jika beli >= 2 jersey -> diskon didistribusikan proporsional sesuai nilai subtotal masing-masing
      let itemDiscount = 0;
      if (orderDiscount > 0 && orderItemsGrossSubtotal > 0) {
        const itemRatio = rawItemSubtotal / orderItemsGrossSubtotal;
        itemDiscount = orderDiscount * itemRatio;
      }
      const itemNetRevenue = Math.max(0, rawItemSubtotal - itemDiscount);

      totalItemsSold += qty;
      totalCost += itemCost;

      productSalesMap[key].soldCount += qty;
      productSalesMap[key].totalOmset += itemNetRevenue;
      productSalesMap[key].totalModal += itemCost;
      if (item.size) {
        productSalesMap[key].sizesSold[item.size] =
          (productSalesMap[key].sizesSold[item.size] ?? 0) + qty;
      }
    });
  });

  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // monthly revenue and monthly profit
  const monthly: Record<string, { revenue: number; cost: number; profit: number }> = {};
  validOrders.forEach((o) => {
    const k = new Date(o.created_at).toLocaleString("id-ID", { month: "short", year: "numeric" });
    if (!monthly[k]) monthly[k] = { revenue: 0, cost: 0, profit: 0 };

    const rev = Math.max(
      0,
      Number(o.subtotal || o.grand_total) - Number((o as any).discount_amount || 0),
    );
    monthly[k].revenue += rev;

    const items = (o as any).order_items || [];
    let orderCost = 0;
    items.forEach((item: any) => {
      const qty = Number(item.quantity) || 1;
      const prodInfo = productCostMap[item.product_id] || productCostMap[item.product_name];
      const itemSizeCost = item.size && prodInfo?.sizeCost?.[item.size];
      const unitCost =
        Number(item.cost_price) > 0
          ? Number(item.cost_price)
          : itemSizeCost !== undefined && Number(itemSizeCost) > 0
            ? Number(itemSizeCost)
            : prodInfo?.defaultCost || 0;
      orderCost += unitCost * qty;
    });
    monthly[k].cost += orderCost;
    monthly[k].profit += rev - orderCost;
  });

  // Gabungkan produk dengan jumlah terjual, modal, omset, dan profit aktual
  const processedProducts = useMemo(() => {
    return (products.data ?? [])
      .map((p) => {
        const sales = productSalesMap[p.id] || productSalesMap[p.name] || {
          soldCount: 0,
          totalOmset: 0,
          totalModal: 0,
          sizesSold: {},
        };

        const soldCount = sales.soldCount;
        const totalOmset = sales.totalOmset || soldCount * Number(p.price || 0);
        const totalModal = sales.totalModal || soldCount * Number((p as any).cost_price || 0);
        const totalLaba = totalOmset - totalModal;
        const profitMargin = totalOmset > 0 ? (totalLaba / totalOmset) * 100 : 0;

        // Hitung rata-rata modal riil dari item yang benar-benar terjual
        const avgSoldUnitCost =
          soldCount > 0
            ? Math.round(totalModal / soldCount)
            : Number((p as any).cost_price ?? 0);
        const avgSoldUnitSell =
          soldCount > 0 ? Math.round(totalOmset / soldCount) : Number(p.price ?? 0);
        const profitPerPcs = avgSoldUnitSell - avgSoldUnitCost;

        return {
          id: p.id,
          name: p.name,
          team: p.team || "—",
          stock: p.stock,
          cost_price: avgSoldUnitCost,
          price: avgSoldUnitSell,
          sold_count: soldCount,
          sizes_sold: sales.sizesSold,
          profit_per_pcs: profitPerPcs,
          total_omset: totalOmset,
          total_modal: totalModal,
          total_laba: totalLaba,
          profit_margin: profitMargin,
        };
      })
      .sort((a, b) => b.total_laba - a.total_laba || b.sold_count - a.sold_count);
  }, [products.data, productSalesMap]);

  const [productSortKey, setProductSortKey] = useState<string | null>(null);
  const [productSortDir, setProductSortDir] = useState<"asc" | "desc" | null>(null);

  function handleProductSort(key: string) {
    if (productSortKey !== key) {
      setProductSortKey(key);
      setProductSortDir("asc");
    } else if (productSortDir === "asc") {
      setProductSortDir("desc");
    } else if (productSortDir === "desc") {
      setProductSortKey(null);
      setProductSortDir(null);
    } else {
      setProductSortKey(key);
      setProductSortDir("asc");
    }
  }

  const sortedProcessedProducts = useMemo(() => {
    if (!productSortKey || !productSortDir) {
      return processedProducts;
    }
    return [...processedProducts].sort((a, b) => {
      let cmp = 0;
      if (productSortKey === "name") {
        cmp = a.name.localeCompare(b.name, "id-ID");
      } else {
        cmp = Number((a as any)[productSortKey] || 0) - Number((b as any)[productSortKey] || 0);
      }
      return productSortDir === "asc" ? cmp : -cmp;
    });
  }, [processedProducts, productSortKey, productSortDir]);

  const renderSortHeader = (label: string, sortKey: string, align: "left" | "right" = "left") => {
    const isActive = productSortKey === sortKey;
    return (
      <th
        onClick={() => handleProductSort(sortKey)}
        className={cn(
          "py-2.5 px-2 cursor-pointer select-none transition-colors hover:text-foreground hover:bg-muted/40 group",
          align === "right" ? "text-right" : "text-left",
          isActive ? "text-primary font-bold bg-primary/5" : ""
        )}
        title="Klik untuk sortir A-Z, Z-A, atau Default"
      >
        <div
          className={cn(
            "inline-flex items-center gap-1",
            align === "right" ? "flex-row-reverse" : "flex-row"
          )}
        >
          <span>{label}</span>
          {isActive ? (
            productSortDir === "asc" ? (
              <ArrowUp className="size-3.5 text-primary shrink-0" />
            ) : (
              <ArrowDown className="size-3.5 text-primary shrink-0" />
            )
          ) : (
            <ArrowUpDown className="size-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  async function handleGenerateAnalysis() {
    setIsAnalyzing(true);
    try {
      const cityCounts: Record<string, number> = {};
      validOrders.forEach((o) => {
        const city = o.recipient_kota || "Lainnya";
        cityCounts[city] = (cityCounts[city] ?? 0) + 1;
      });
      const cityDistribution = Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const monthlyList = Object.entries(monthly).map(([month, val]) => ({
        month,
        revenue: val.revenue,
      }));

      const bestSellersList = processedProducts
        .map((p) => ({
          name: p.name,
          sold_count: p.sold_count,
          stock: p.stock ?? 0,
          price: Number(p.price) ?? 0,
          team: p.team || null,
        }))
        .slice(0, 10);

      const result = await analyzeSalesData({
        data: {
          totalRevenue,
          validOrdersCount: validOrders.length,
          totalCustomersCount: customers.data?.length ?? 0,
          monthlyRevenue: monthlyList,
          bestSellers: bestSellersList,
          cityDistribution,
        },
      });

      if (result?.analysis) {
        setAnalysis(result.analysis);
        toast.success("Analisis penjualan berhasil dibuat!");
      } else {
        toast.error("Gagal mendapatkan analisis dari AI.");
      }
    } catch (err) {
      console.error(err);
      const errMessage = err instanceof Error ? err.message : String(err);
      toast.error("Gagal melakukan analisis penjualan: " + errMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const [savedAnalyses, setSavedAnalyses] = useState<
    { id: string; date: string; content: string }[]
  >([]);

  useEffect(() => {
    const raw = localStorage.getItem("saved_sales_analyses");
    if (raw) {
      try {
        setSavedAnalyses(JSON.parse(raw));
      } catch (e) {
        console.error("Gagal membaca riwayat analisis dari localStorage", e);
      }
    }
  }, []);

  function handleSaveAnalysis() {
    if (!analysis) return;
    const newSave = {
      id: crypto.randomUUID(),
      date: new Date().toLocaleString("id-ID", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      content: analysis,
    };
    const updated = [newSave, ...savedAnalyses];
    setSavedAnalyses(updated);
    localStorage.setItem("saved_sales_analyses", JSON.stringify(updated));
    toast.success("Analisis penjualan berhasil disimpan!");
  }

  function handleDeleteSaved(id: string) {
    const updated = savedAnalyses.filter((item) => item.id !== id);
    setSavedAnalyses(updated);
    localStorage.setItem("saved_sales_analyses", JSON.stringify(updated));
    toast.success("Analisis tersimpan telah dihapus");
  }

  function handleDownloadPDF() {
    if (!analysis) {
      toast.error("Belum ada analisis AI yang dibuat.");
      return;
    }
    try {
      generateAIReportPDF(analysis);
      toast.success("Laporan Strategis AI (PDF) berhasil diunduh!");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Gagal mengunduh PDF: " + (e?.message || "Terjadi kesalahan"));
    }
  }

  function handleExportProductProfitPDF() {
    try {
      generateProductProfitPDF({
        products: sortedProcessedProducts,
        totalOmset: totalRevenue,
        totalModal: totalCost,
        totalLaba: totalProfit,
        avgMargin,
        totalPcs: totalItemsSold,
      });
      toast.success("Laporan Profit Produk (PDF) berhasil diunduh!");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Gagal mengunduh PDF: " + (e?.message || "Terjadi kesalahan"));
    }
  }

  function handleExportMonthlyProfitPDF() {
    try {
      const monthlyList = Object.entries(monthly).map(([month, val]) => ({
        month,
        revenue: val.revenue,
        cost: val.cost,
        profit: val.profit,
      }));
      generateMonthlyProfitPDF({
        monthlyList,
        totalOmset: totalRevenue,
        totalModal: totalCost,
        totalLaba: totalProfit,
      });
      toast.success("Laporan Rekap Bulanan (PDF) berhasil diunduh!");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Gagal mengunduh PDF: " + (e?.message || "Terjadi kesalahan"));
    }
  }

  function handleExportOrdersPDF() {
    try {
      generateOrdersReportPDF(orders.data ?? []);
      toast.success("Laporan Transaksi Pesanan (PDF) berhasil diunduh!");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Gagal mengunduh PDF: " + (e?.message || "Terjadi kesalahan"));
    }
  }

  // State untuk modal drill-down detail KPI cards
  const [activeCardDetail, setActiveCardDetail] = useState<
    "omset" | "modal" | "profit" | "volume" | null
  >(null);

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Laporan" title="Laporan Finansial & Penjualan" />

      {/* 4 Financial KPI Cards - Clickable for details */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
        {/* CARD 1: TOTAL OMSET */}
        <Card
          onClick={() => setActiveCardDetail("omset")}
          className="group border-border p-3 sm:p-4 rounded-xl cursor-pointer hover:border-primary/50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors truncate">
              Total Omset
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0 flex items-center gap-1">
              Lunas
              <ChevronRight className="size-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate">
            {formatIDR(totalRevenue)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate flex items-center justify-between">
            <span>{validOrders.length} pesanan berhasil</span>
            <span className="text-[9px] text-primary/80 font-medium group-hover:underline hidden sm:inline">
              Detail &rarr;
            </span>
          </p>
        </Card>

        {/* CARD 2: TOTAL MODAL (COGS) */}
        <Card
          onClick={() => setActiveCardDetail("modal")}
          className="group border-border p-3 sm:p-4 rounded-xl cursor-pointer hover:border-amber-500/50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
              Total Modal
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0 flex items-center gap-1">
              COGS
              <ChevronRight className="size-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-muted-foreground mt-2 truncate">
            {formatIDR(totalCost)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate flex items-center justify-between">
            <span>Biaya pokok {totalItemsSold} pcs</span>
            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-medium group-hover:underline hidden sm:inline">
              Detail &rarr;
            </span>
          </p>
        </Card>

        {/* CARD 3: KEUNTUNGAN */}
        <Card
          onClick={() => setActiveCardDetail("profit")}
          className="group border-border border-emerald-500/30 bg-emerald-500/[0.03] p-3 sm:p-4 rounded-xl cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Keuntungan
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0 flex items-center gap-1">
              {avgMargin.toFixed(0)}%
              <ChevronRight className="size-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate">
            {formatIDR(totalProfit)}
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium truncate flex items-center justify-between">
            <span>Laba kotor bersih</span>
            <span className="text-[9px] text-emerald-600 font-bold group-hover:underline hidden sm:inline">
              Detail &rarr;
            </span>
          </p>
        </Card>

        {/* CARD 4: VOLUME */}
        <Card
          onClick={() => setActiveCardDetail("volume")}
          className="group border-border p-3 sm:p-4 rounded-xl cursor-pointer hover:border-sky-500/50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 relative overflow-hidden"
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors truncate">
              Volume
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0 flex items-center gap-1">
              Pcs
              <ChevronRight className="size-2.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate">
            {totalItemsSold} pcs
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate flex items-center justify-between">
            <span>{customers.data?.length ?? 0} user terdaftar</span>
            <span className="text-[9px] text-sky-600 dark:text-sky-400 font-medium group-hover:underline hidden sm:inline">
              Detail &rarr;
            </span>
          </p>
        </Card>
      </div>

      {/* Tabel Analisis Profitabilitas per Produk */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h3 className="font-extrabold text-base">Analisis Keuntungan per Produk</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rincian modal, omset, dan laba bersih dari setiap produk jersey yang terjual
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportProductProfitPDF}
            className="w-full sm:w-auto h-8 text-xs font-bold gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer shadow-sm"
          >
            <FileText className="size-3.5" />
            <span>Unduh Laporan PDF</span>
          </Button>
        </div>

        {/* Mobile Product Profit Cards (< lg) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
          {sortedProcessedProducts.map((p) => (
            <div
              key={p.id}
              className="p-3 rounded-xl border border-border bg-card/60 space-y-2.5 shadow-sm text-xs"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-foreground line-clamp-1">{p.name}</h4>
                  <div className="text-[11px] text-muted-foreground truncate">{p.team || "—"}</div>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0",
                    p.sold_count > 0
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {p.sold_count} pcs terjual
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Modal / Jual</span>
                  <span className="text-muted-foreground font-mono">{formatIDR(p.cost_price)}</span>
                  <span className="text-foreground font-bold block">{formatIDR(p.price)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground block">Total Omset</span>
                  <span className="font-bold text-foreground">{formatIDR(p.total_omset)}</span>
                  <span className="text-[10px] text-muted-foreground block">
                    Modal: {formatIDR(p.total_modal)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                <span className="text-[11px] text-muted-foreground">Laba Bersih:</span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "font-extrabold",
                      p.total_laba > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : p.total_laba < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {formatIDR(p.total_laba)}
                  </span>
                  {p.sold_count > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {p.profit_margin.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View (>= lg) */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                {renderSortHeader("Produk", "name", "left")}
                {renderSortHeader("Terjual", "sold_count", "left")}
                {renderSortHeader("Modal/Pcs", "cost_price", "right")}
                {renderSortHeader("Harga Jual", "price", "right")}
                {renderSortHeader("Total Omset", "total_omset", "right")}
                {renderSortHeader("Total Modal", "total_modal", "right")}
                {renderSortHeader("Total Keuntungan", "total_laba", "right")}
                {renderSortHeader("Margin", "profit_margin", "right")}
              </tr>
            </thead>
            <tbody>
              {sortedProcessedProducts.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/10">
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-xs sm:text-sm">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">{p.team}</div>
                  </td>
                  <td className="text-xs">
                    <span className="font-bold">{p.sold_count}</span>
                    <span className="text-muted-foreground text-[11px]"> ({p.stock} sisa)</span>
                  </td>
                  <td className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatIDR(p.cost_price)}
                  </td>
                  <td className="text-right tabular-nums text-xs font-medium">
                    {formatIDR(p.price)}
                  </td>
                  <td className="text-right tabular-nums text-xs font-semibold">
                    {formatIDR(p.total_omset)}
                  </td>
                  <td className="text-right tabular-nums text-xs text-muted-foreground">
                    {formatIDR(p.total_modal)}
                  </td>
                  <td className="text-right tabular-nums text-xs font-bold">
                    <span
                      className={
                        p.total_laba > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : p.total_laba < 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-muted-foreground"
                      }
                    >
                      {formatIDR(p.total_laba)}
                    </span>
                  </td>
                  <td className="text-right tabular-nums text-xs">
                    {p.sold_count > 0 ? (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          p.profit_margin > 0
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {p.profit_margin.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mb-5 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary shrink-0" />
            <h3 className="font-extrabold text-base">Asisten Penjualan & Finansial AI</h3>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateAnalysis}
            disabled={isAnalyzing}
            className="gap-1.5 w-full sm:w-auto font-bold text-xs h-9 cursor-pointer shadow-sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Menganalisis...</span>
              </>
            ) : (
              <>
                <Wand2 className="size-3.5" />
                <span>Mulai Analisis AI</span>
              </>
            )}
          </Button>
        </div>

        {analysis ? (
          <div className="space-y-4">
            <div className="bg-background/80 p-4 sm:p-5 rounded-xl border border-border shadow-xs">
              <FormattedMarkdownReport content={analysis} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5 h-8 text-xs font-bold flex-1 sm:flex-none cursor-pointer"
              >
                <FileText className="size-3.5" />
                <span>Unduh PDF Laporan AI</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAnalysis}
                className="gap-1.5 border-primary/20 text-foreground hover:bg-muted h-8 text-xs font-semibold flex-1 sm:flex-none cursor-pointer"
              >
                <Save className="size-3.5" />
                <span>Simpan Analisis</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Klik tombol di atas untuk menganalisis data penjualan Anda, memprediksi tren masa depan,
            dan mendapatkan strategi bisnis konkret.
          </p>
        )}
      </Card>

      {savedAnalyses.length > 0 && (
        <Card className="mb-5">
          <h3 className="font-extrabold text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Riwayat Analisis Tersimpan
          </h3>
          <div className="space-y-2.5">
            {savedAnalyses.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
              >
                <div className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Analisis Penjualan</p>
                  <p className="text-xs font-bold text-foreground">{item.date}</p>
                </div>
                <div className="flex gap-1.5 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAnalysis(item.content);
                      toast.success(`Berhasil memuat analisis tanggal ${item.date}`);
                    }}
                    className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/5 font-semibold cursor-pointer"
                  >
                    Buka
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSaved(item.id)}
                    className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 font-semibold cursor-pointer"
                  >
                    <Trash2 className="size-3 mr-1" />
                    <span>Hapus</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Ringkasan Omset & Profit per Bulan */}
      <Card className="mb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 mb-4">
          <div>
            <h3 className="font-extrabold text-base">Omset & Profit per Bulan</h3>
            <p className="text-xs text-muted-foreground">Rekap pendapatan, beban modal, dan laba per periode bulanan</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportMonthlyProfitPDF}
            className="w-full sm:w-auto h-8 text-xs font-bold gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer shadow-sm"
          >
            <FileText className="size-3.5" />
            <span>Unduh Laporan PDF</span>
          </Button>
        </div>

        {/* Mobile Monthly Cards (< md) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
          {Object.entries(monthly).map(([k, v]) => {
            const mMargin = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
            return (
              <div
                key={k}
                className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5 shadow-sm text-xs"
              >
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Calendar className="size-3.5 text-primary" />
                    <span>{k}</span>
                  </span>
                  <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
                    Margin {mMargin.toFixed(0)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Omset</span>
                    <span className="font-extrabold text-sm text-foreground">{formatIDR(v.revenue)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Modal (HPP)</span>
                    <span className="font-medium text-muted-foreground">{formatIDR(v.cost)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <span className="text-[11px] text-muted-foreground">Keuntungan Bersih:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatIDR(v.profit)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                <th className="py-2">Bulan</th>
                <th className="text-right">Omset</th>
                <th className="text-right">Modal</th>
                <th className="text-right">Keuntungan</th>
                <th className="text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(monthly).map(([k, v]) => {
                const mMargin = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
                return (
                  <tr key={k} className="border-b border-border/50">
                    <td className="py-2.5 font-medium">{k}</td>
                    <td className="text-right tabular-nums">{formatIDR(v.revenue)}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{formatIDR(v.cost)}</td>
                    <td className="text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                      {formatIDR(v.profit)}
                    </td>
                    <td className="text-right tabular-nums text-xs">
                      <span className="bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">
                        {mMargin.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 mb-4">
          <div>
            <h3 className="font-extrabold text-base">Laporan Transaksi Pesanan</h3>
            <p className="text-xs text-muted-foreground">Ekspor rekapitulasi data seluruh transaksi pesanan ke format PDF</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportOrdersPDF}
            className="w-full sm:w-auto h-8 text-xs font-bold gap-1.5 shrink-0 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer shadow-sm"
          >
            <FileText className="size-3.5" />
            <span>Unduh Laporan PDF</span>
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Ekspor dokumen resmi riwayat transaksi pesanan dengan kop surat toko, status pengiriman, rincian pembayaran, dan tanda tangan pengesahan.
        </p>
        <p className="text-[11px] text-muted-foreground mt-2">
          Total transaksi tercatat: {orders.data?.length ?? 0} pesanan · Pelanggan: {customers.data?.length ?? 0} ({formatDate(new Date())}).
        </p>
      </Card>
      {/* MODAL DRILL-DOWN DETAIL STATISTIK KPI */}
      <Dialog
        open={activeCardDetail !== null}
        onOpenChange={(open) => !open && setActiveCardDetail(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          {activeCardDetail === "omset" && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground">
                      Rincian Total Omset Penjualan
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Total penerimaan dari pesanan yang telah lunas &amp; selesai diproses
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Stat Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Total Omset Bersih
                  </div>
                  <div className="text-base sm:text-lg font-black text-primary">
                    {formatIDR(totalRevenue)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Pesanan Berhasil
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {validOrders.length} Transaksi
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Rata-rata / Pesanan
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {validOrders.length > 0
                      ? formatIDR(Math.round(totalRevenue / validOrders.length))
                      : "Rp 0"}
                  </div>
                </div>
              </div>

              {/* List Transaksi yang Menyumbang Omset */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Daftar Pesanan Berhasil
                  </h4>
                  <Link
                    to="/admin/pesanan"
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Kelola Semua Pesanan</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {validOrders.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Belum ada transaksi berstatus lunas.
                    </div>
                  ) : (
                    validOrders.map((o) => {
                      const netOrder = Math.max(
                        0,
                        Number(o.subtotal || o.grand_total) -
                          Number((o as any).discount_amount || 0),
                      );
                      const discount = Number((o as any).discount_amount) || 0;
                      const itemsCount = (o as any).order_items?.reduce(
                        (sum: number, it: any) => sum + (Number(it.quantity) || 1),
                        0,
                      ) || 0;

                      return (
                        <div
                          key={o.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/30 transition-colors text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-foreground">
                                {o.order_number}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-primary/10 text-primary border border-primary/20 capitalize">
                                {o.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {o.recipient_name || "Pelanggan"} · {itemsCount} pcs jersey
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatDate(o.created_at)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-extrabold text-foreground text-sm">
                              {formatIDR(netOrder)}
                            </div>
                            {discount > 0 && (
                              <div className="text-[10px] text-rose-500 font-medium">
                                Potongan -{formatIDR(discount)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {activeCardDetail === "modal" && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Coins className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground">
                      Rincian Modal Produk (COGS)
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Biaya pokok modal jersey berdasarkan unit yang benar-benar terjual
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Stat Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Total Biaya Modal
                  </div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">
                    {formatIDR(totalCost)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Jersey Terjual
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {totalItemsSold} Pcs
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Rata-rata Modal / Pcs
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {totalItemsSold > 0
                      ? formatIDR(Math.round(totalCost / totalItemsSold))
                      : "Rp 0"}
                  </div>
                </div>
              </div>

              {/* List Produk yang Berkontribusi Modal */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Penyerap Biaya Modal Terbanyak
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {processedProducts
                    .filter((p) => p.sold_count > 0)
                    .sort((a, b) => b.total_modal - a.total_modal)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/30 transition-colors text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-foreground truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.sold_count} pcs x {formatIDR(p.cost_price)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">
                            {formatIDR(p.total_modal)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {totalCost > 0
                              ? ((p.total_modal / totalCost) * 100).toFixed(0) + "% dari total modal"
                              : "0%"}
                          </div>
                        </div>
                      </div>
                    ))}
                  {processedProducts.filter((p) => p.sold_count > 0).length === 0 && (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Belum ada penjualan produk.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeCardDetail === "profit" && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground">
                      Rincian Keuntungan &amp; Margin
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Kalkulasi Laba Bersih = Omset Bersih dikurangi Beban Modal Pokok Jersey
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Stat Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-bold">
                    Laba Bersih
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {formatIDR(totalProfit)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-bold">
                    Margin Rata-rata
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {avgMargin.toFixed(1)}%
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-bold">
                    Laba / Pcs Terjual
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {totalItemsSold > 0
                      ? formatIDR(Math.round(totalProfit / totalItemsSold))
                      : "Rp 0"}
                  </div>
                </div>
              </div>

              {/* Rumus Ringkas */}
              <div className="p-3 rounded-lg border border-border bg-muted/30 text-xs space-y-1.5">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" />
                  <span>Kalkulasi Rumus Finansial:</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Omset (setelah diskon/nego):</span>
                  <span className="font-semibold text-foreground font-mono">{formatIDR(totalRevenue)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Modal Jersey (COGS):</span>
                  <span className="font-semibold text-rose-500 font-mono">- {formatIDR(totalCost)}</span>
                </div>
                <div className="border-t border-border pt-1 flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Keuntungan Kotor Bersih:</span>
                  <span className="font-mono">{formatIDR(totalProfit)}</span>
                </div>
              </div>

              {/* Top 3 Produk Paling Menguntungkan */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Top Jersey Paling Profit
                </h4>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {processedProducts
                    .filter((p) => p.sold_count > 0)
                    .sort((a, b) => b.total_laba - a.total_laba)
                    .slice(0, 5)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/70 bg-card text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-foreground truncate">{p.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Terjual {p.sold_count} pcs · Margin {p.profit_margin.toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                            +{formatIDR(p.total_laba)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeCardDetail === "volume" && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <PackageCheck className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base sm:text-lg font-extrabold text-foreground">
                      Rincian Volume Penjualan &amp; User
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Statistik kuantitas jersey yang beredar serta basis pelanggan terdaftar
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Stat Summary Box */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Jersey Terjual
                  </div>
                  <div className="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400">
                    {totalItemsSold} Pcs
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    User Terdaftar
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {customers.data?.length ?? 0} Pelanggan
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">
                    Rata-rata Item / Order
                  </div>
                  <div className="text-base sm:text-lg font-bold text-foreground">
                    {validOrders.length > 0
                      ? (totalItemsSold / validOrders.length).toFixed(1) + " pcs"
                      : "0 pcs"}
                  </div>
                </div>
              </div>

              {/* Rincian Ukuran Terjual */}
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Distribusi Ukuran Jersey Terjual</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Total {totalItemsSold} pcs
                  </span>
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(() => {
                    const sizeTotals: Record<string, number> = {};
                    validOrders.forEach((o) => {
                      (o as any).order_items?.forEach((it: any) => {
                        const sz = it.size || "All Size";
                        const qty = Number(it.quantity) || 1;
                        sizeTotals[sz] = (sizeTotals[sz] || 0) + qty;
                      });
                    });
                    const entries = Object.entries(sizeTotals);
                    if (entries.length === 0) {
                      return (
                        <div className="col-span-full text-center py-4 text-xs text-muted-foreground">
                          Belum ada data ukuran.
                        </div>
                      );
                    }
                    return entries.map(([sz, qty]) => (
                      <div
                        key={sz}
                        className="p-2.5 rounded-lg border border-border bg-card text-center"
                      >
                        <div className="text-[10px] uppercase font-bold text-muted-foreground">
                          Size {sz}
                        </div>
                        <div className="text-sm font-extrabold text-foreground mt-0.5">
                          {qty} pcs
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {totalItemsSold > 0 ? ((qty / totalItemsSold) * 100).toFixed(0) + "%" : "0%"}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Pelanggan Terbaru */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Pelanggan Terdaftar Terbaru
                  </h4>
                  <Link
                    to="/admin/pelanggan"
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Lihat Semua Pelanggan</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {(customers.data ?? []).slice(0, 5).map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-muted/20 text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-semibold text-foreground truncate block">
                          {c.nama_lengkap || c.email?.split("@")[0] || "User"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.kota || "Kota belum diisi"}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                        {c.created_at ? formatDate(c.created_at) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

/**
 * Komponen untuk merender output laporan Markdown dari AI dengan rapi:
 * - ## Header 2: Judul Bab Berwarna Hijau Brand dengan Aksen
 * - ### Header 3: Subheader Bold
 * - **Teks Bold**: Font tebal tegas
 * - - Bullet Points: List rapi dengan bullet emerald
 */
function FormattedMarkdownReport({ content }: { content: string }) {
  const lines = content.split("\n");

  const renderInline = (text: string) => {
    // Membagi teks berdasarkan pola **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-extrabold text-foreground tracking-tight">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={key} className="space-y-2 my-2.5 pl-1">
          {currentList.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <span className="size-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <div className="flex-1">{renderInline(item)}</div>
            </li>
          ))}
        </ul>,
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList(`list-${index}`);
      return;
    }

    if (trimmed.startsWith("## ")) {
      flushList(`list-${index}`);
      elements.push(
        <div
          key={`h2-${index}`}
          className="mt-5 mb-2.5 first:mt-0 pt-3 border-t border-border/40 first:border-0 first:pt-0"
        >
          <h4 className="text-sm sm:text-base font-extrabold text-primary flex items-center gap-2">
            <span className="size-2 rounded-sm bg-primary/80 shrink-0" />
            <span>{trimmed.replace(/^##\s+/, "")}</span>
          </h4>
        </div>,
      );
    } else if (trimmed.startsWith("### ")) {
      flushList(`list-${index}`);
      elements.push(
        <h5 key={`h3-${index}`} className="text-xs sm:text-sm font-bold text-foreground mt-3 mb-1.5">
          {trimmed.replace(/^###\s+/, "")}
        </h5>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.match(/^\d+\.\s/)) {
      const cleanItem = trimmed.replace(/^([-*]|\d+\.)\s+/, "");
      currentList.push(cleanItem);
    } else {
      flushList(`list-${index}`);
      elements.push(
        <p key={`p-${index}`} className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2.5">
          {renderInline(trimmed)}
        </p>,
      );
    }
  });

  flushList("list-end");

  return <div className="space-y-0.5">{elements}</div>;
}

