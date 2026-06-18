import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { formatIDR, formatDate } from "@/lib/format";

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
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const Route = createFileRoute("/_authenticated/_admin/admin/laporan")({
  component: AdminReports,
});

function AdminReports() {
  const orders = useQuery({
    queryKey: ["report-orders"],
    queryFn: async () => (await supabase.from("orders").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const products = useQuery({
    queryKey: ["report-products"],
    queryFn: async () => (await supabase.from("products").select("name, team, stock, sold_count, price").order("sold_count", { ascending: false })).data ?? [],
  });
  const customers = useQuery({
    queryKey: ["report-customers"],
    queryFn: async () => (await supabase.from("profiles").select("email, nama_lengkap, kota, created_at")).data ?? [],
  });

  const validOrders = (orders.data ?? []).filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status));
  const totalRevenue = validOrders.reduce((s, o) => s + Number(o.grand_total), 0);

  // monthly revenue
  const monthly: Record<string, number> = {};
  validOrders.forEach((o) => {
    const k = new Date(o.created_at).toLocaleString("id-ID", { month: "short", year: "numeric" });
    monthly[k] = (monthly[k] ?? 0) + Number(o.grand_total);
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Laporan" title="Laporan & Ekspor" />

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card><div className="eyebrow text-muted-foreground">Total Revenue</div><div className="display-md mt-2">{formatIDR(totalRevenue)}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Pesanan Valid</div><div className="display-md mt-2">{validOrders.length}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Pelanggan</div><div className="display-md mt-2">{customers.data?.length ?? 0}</div></Card>
      </div>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Revenue per Bulan</h3>
          <Button size="sm" variant="outline" onClick={() => download("revenue.csv", toCSV(Object.entries(monthly).map(([k, v]) => ({ bulan: k, revenue: v }))))}>Ekspor CSV</Button>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {Object.entries(monthly).map(([k, v]) => (
              <tr key={k} className="border-b border-border/50"><td className="py-2">{k}</td><td className="text-right tabular-nums">{formatIDR(v)}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Best Sellers</h3>
          <Button size="sm" variant="outline" onClick={() => download("best-sellers.csv", toCSV(products.data ?? []))}>Ekspor CSV</Button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border"><th className="py-2">Produk</th><th>Terjual</th><th>Stok</th></tr></thead>
          <tbody>
            {(products.data ?? []).slice(0, 10).map((p) => (
              <tr key={p.name} className="border-b border-border/50"><td className="py-2">{p.name}</td><td>{p.sold_count}</td><td>{p.stock}</td></tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-extrabold">Laporan Pesanan</h3>
          <Button size="sm" variant="outline" onClick={() => download("orders.csv", toCSV(orders.data ?? []))}>Ekspor Semua Pesanan (CSV)</Button>
        </div>
        <p className="text-sm text-muted-foreground">Ekspor data lengkap pesanan ke file CSV — dapat dibuka langsung di Excel.</p>
        <p className="text-xs text-muted-foreground mt-2">Total pelanggan tercatat: {customers.data?.length ?? 0} ({formatDate(new Date())}).</p>
      </Card>
    </DashboardShell>
  );
}
