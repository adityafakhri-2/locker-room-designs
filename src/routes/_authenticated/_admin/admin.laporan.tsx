import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDate } from "@/lib/format";
import { Sparkles, Loader2, Wand2, Download, Save, Trash2 } from "lucide-react";
import { analyzeSalesData } from "@/lib/api/ai.functions";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

function download(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/_admin/admin/laporan")({
  component: AdminReports,
});

function AdminReports() {
  const orders = useQuery({
    queryKey: ["report-orders"],
    queryFn: async () =>
      (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ??
      [],
  });
  const products = useQuery({
    queryKey: ["report-products"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("name, team, stock, sold_count, price")
          .order("sold_count", { ascending: false })
      ).data ?? [],
  });
  const customers = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () =>
      (await supabase.from("profiles").select("email, nama_lengkap, kota, created_at")).data ?? [],
  });

  const validOrders = (orders.data ?? []).filter((o) =>
    ["paid", "processing", "shipped", "delivered"].includes(o.status),
  );
  const totalRevenue = validOrders.reduce((s, o) => s + Number(o.grand_total), 0);

  // monthly revenue
  const monthly: Record<string, number> = {};
  validOrders.forEach((o) => {
    const k = new Date(o.created_at).toLocaleString("id-ID", { month: "short", year: "numeric" });
    monthly[k] = (monthly[k] ?? 0) + Number(o.grand_total);
  });

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

      const monthlyList = Object.entries(monthly).map(([month, revenue]) => ({
        month,
        revenue,
      }));

      const bestSellersList = (products.data ?? [])
        .map((p) => ({
          name: p.name,
          sold_count: p.sold_count ?? 0,
          stock: p.stock ?? 0,
          price: p.price ?? 0,
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
    } catch (err: any) {
      console.error(err);
      toast.error("Gagal melakukan analisis penjualan: " + (err.message || err));
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
    if (!analysis) return;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const formattedDate = new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      printWindow.document.write(`
        <html>
          <head>
            <title>Laporan Analisis Penjualan - The Locker Room</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
              body {
                font-family: 'Inter', sans-serif;
                color: #1e293b;
                padding: 50px;
                line-height: 1.7;
                background-color: #ffffff;
                max-width: 800px;
                margin: 0 auto;
              }
              .header {
                border-bottom: 3px solid #10b981;
                padding-bottom: 25px;
                margin-bottom: 35px;
                display: flex;
                flex-direction: column;
              }
              .logo {
                font-size: 26px;
                font-weight: 800;
                color: #10b981;
                text-transform: uppercase;
                letter-spacing: 1.5px;
              }
              .title {
                font-size: 22px;
                font-weight: 700;
                margin-top: 15px;
                color: #0f172a;
              }
              .meta {
                font-size: 13px;
                color: #64748b;
                margin-top: 8px;
              }
              .content {
                font-size: 15px;
                white-space: pre-wrap;
                color: #334155;
              }
              .footer {
                margin-top: 60px;
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
                font-size: 12px;
                color: #94a3b8;
                text-align: center;
              }
              @media print {
                body {
                  padding: 20px;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="logo">THE LOCKER ROOM</div>
              <div class="title">Laporan Analisis Strategi Penjualan AI</div>
              <div class="meta">Diproduksi pada: ${formattedDate}</div>
            </div>
            <div class="content">${analysis}</div>
            <div class="footer">
              Laporan ini dibuat otomatis oleh Asisten Penjualan AI Locker Room. Hak Cipta Dilindungi Undang-Undang.
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.onafterprint = function() {
                    window.close();
                  };
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      toast.error("Gagal membuka jendela cetak. Pastikan pop-up diperbolehkan di browser Anda.");
    }
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Laporan" title="Laporan & Ekspor" />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="eyebrow text-muted-foreground">Total Revenue</div>
          <div className="display-md mt-2">{formatIDR(totalRevenue)}</div>
        </Card>
        <Card>
          <div className="eyebrow text-muted-foreground">Pesanan Valid</div>
          <div className="display-md mt-2">{validOrders.length}</div>
        </Card>
        <Card>
          <div className="eyebrow text-muted-foreground">Pelanggan</div>
          <div className="display-md mt-2">{customers.data?.length ?? 0}</div>
        </Card>
      </div>

      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h3 className="font-extrabold text-base">Asisten Penjualan AI</h3>
          </div>
          <Button
            size="sm"
            onClick={handleGenerateAnalysis}
            disabled={isAnalyzing}
            className="gap-1.5"
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
            <div className="text-sm text-muted-foreground whitespace-pre-line bg-background/60 p-4 rounded-lg border border-border/50 leading-relaxed">
              {analysis}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPDF}
                className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 h-9"
              >
                <Download className="size-3.5" />
                <span>Unduh PDF</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveAnalysis}
                className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 h-9"
              >
                <Save className="size-3.5" />
                <span>Simpan Analisis</span>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Klik tombol di atas untuk menganalisis data penjualan Anda, memprediksi tren masa depan,
            dan mendapatkan strategi bisnis konkret.
          </p>
        )}
      </Card>

      {savedAnalyses.length > 0 && (
        <Card className="mb-6">
          <h3 className="font-extrabold text-sm text-muted-foreground uppercase tracking-wider mb-4">
            Riwayat Analisis Tersimpan
          </h3>
          <div className="space-y-3">
            {savedAnalyses.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/40 transition-all duration-200"
              >
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Analisis Penjualan</p>
                  <p className="text-sm font-semibold text-foreground">{item.date}</p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAnalysis(item.content);
                      toast.success(`Berhasil memuat analisis tanggal ${item.date}`);
                    }}
                    className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/5 font-semibold"
                  >
                    Buka
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSaved(item.id)}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/5 font-semibold"
                  >
                    <Trash2 className="size-3.5 mr-1" />
                    <span>Hapus</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Revenue per Bulan</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              download(
                "revenue.csv",
                toCSV(Object.entries(monthly).map(([k, v]) => ({ bulan: k, revenue: v }))),
              )
            }
          >
            Ekspor CSV
          </Button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(monthly).map(([k, v]) => (
              <tr key={k} className="border-b border-border/50">
                <td className="py-2">{k}</td>
                <td className="text-right tabular-nums">{formatIDR(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Best Sellers</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download("best-sellers.csv", toCSV(products.data ?? []))}
          >
            Ekspor CSV
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left eyebrow text-muted-foreground border-b border-border">
              <th className="py-2">Produk</th>
              <th>Terjual</th>
              <th>Stok</th>
            </tr>
          </thead>
          <tbody>
            {(products.data ?? []).slice(0, 10).map((p) => (
              <tr key={p.name} className="border-b border-border/50">
                <td className="py-2">{p.name}</td>
                <td>{p.sold_count}</td>
                <td>{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Laporan Pesanan</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => download("orders.csv", toCSV(orders.data ?? []))}
          >
            Ekspor Semua Pesanan (CSV)
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ekspor data lengkap pesanan ke file CSV — dapat dibuka langsung di Excel.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Total pelanggan tercatat: {customers.data?.length ?? 0} ({formatDate(new Date())}).
        </p>
      </Card>
    </DashboardShell>
  );
}
