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
import { Sparkles, Loader2, Wand2, Download, Save, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, Printer, Calendar } from "lucide-react";
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
      const itemRevenue = Number(item.subtotal) || unitSell * qty;
      const itemCost = unitCost * qty;

      totalItemsSold += qty;
      totalCost += itemCost;

      productSalesMap[key].soldCount += qty;
      productSalesMap[key].totalOmset += itemRevenue;
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

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Laporan" title="Laporan Finansial & Penjualan" />

      {/* 4 Financial KPI Cards - 2 per row on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5">
        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Omset
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
              Lunas
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate">
            {formatIDR(totalRevenue)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {validOrders.length} pesanan berhasil
          </p>
        </Card>

        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Total Modal
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
              COGS
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-muted-foreground mt-2 truncate">
            {formatIDR(totalCost)}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            Biaya pokok {totalItemsSold} pcs
          </p>
        </Card>

        <Card className="border-border border-emerald-500/30 bg-emerald-500/[0.03] p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 truncate">
              Keuntungan
            </span>
            <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
              {avgMargin.toFixed(0)}%
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate">
            {formatIDR(totalProfit)}
          </div>
          <p className="text-[10px] sm:text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 font-medium truncate">
            Laba kotor bersih
          </p>
        </Card>

        <Card className="border-border p-3 sm:p-4 rounded-xl">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
              Volume
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border shrink-0">
              Pcs
            </span>
          </div>
          <div className="text-sm sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground mt-2 truncate">
            {totalItemsSold} pcs
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
            {customers.data?.length ?? 0} user terdaftar
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
            <div className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line bg-background/60 p-3.5 rounded-lg border border-border/50 leading-relaxed">
              {analysis}
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
    </DashboardShell>
  );
}
