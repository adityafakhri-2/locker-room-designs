import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { formatIDR, statusLabel } from "@/lib/format";

export const ADMIN_NAV = [
  { label: "Dashboard", to: "/admin" },
  { label: "Produk", to: "/admin/produk" },
  { label: "Kategori", to: "/admin/kategori" },
  { label: "Koleksi", to: "/admin/koleksi" },
  { label: "Pesanan", to: "/admin/pesanan" },
  { label: "Pelanggan", to: "/admin/pelanggan" },
  { label: "Ulasan", to: "/admin/ulasan" },
  { label: "Laporan", to: "/admin/laporan" },
];

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, orders, customers, revenue] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, grand_total, status, created_at, order_number, recipient_name, payments(status)"),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "customer"),
        supabase.from("orders").select("grand_total, status"),
      ]);
      const allOrders = orders.data ?? [];
      const totalRevenue = (revenue.data ?? []).filter((o) => ["paid", "processing", "shipped", "delivered"].includes(o.status)).reduce((s, o) => s + Number(o.grand_total), 0);
      return {
        productsCount: products.count ?? 0,
        customersCount: customers.count ?? 0,
        ordersCount: allOrders.length,
        totalRevenue,
        recent: allOrders.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6),
        byStatus: allOrders.reduce((acc, o) => ({ ...acc, [o.status]: (acc[o.status] ?? 0) + 1 }), {} as Record<string, number>),
      };
    },
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Admin" title="Dashboard" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><div className="eyebrow text-muted-foreground">Total Revenue</div><div className="display-md mt-2 text-2xl sm:text-3xl lg:text-xl xl:text-3xl truncate" title={formatIDR(stats.data?.totalRevenue ?? 0)}>{formatIDR(stats.data?.totalRevenue ?? 0)}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Total Pesanan</div><div className="display-md mt-2">{stats.data?.ordersCount ?? 0}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Total Produk</div><div className="display-md mt-2">{stats.data?.productsCount ?? 0}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Total Pelanggan</div><div className="display-md mt-2">{stats.data?.customersCount ?? 0}</div></Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-extrabold text-lg mb-4">Pesanan Terbaru</h2>
        {stats.data?.recent.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border"><th className="py-2">Order</th><th>Penerima</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {stats.data.recent.map((o) => {
                const payment = Array.isArray(o.payments) ? o.payments[0] : (o.payments as any);
                const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
                  ? "waiting_verification"
                  : o.status;
                const isWaitingConfirm = displayStatus === "waiting_verification";

                return (
                  <tr key={o.order_number} className="border-b border-border/50">
                    <td className="py-2"><Link to="/admin/pesanan/$orderNumber" params={{ orderNumber: o.order_number }} className="font-mono text-xs hover:underline cursor-pointer">{o.order_number}</Link></td>
                    <td>{o.recipient_name}</td>
                    <td className="py-2">
                      {isWaitingConfirm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 animate-pulse">
                          Menunggu Konfirmasi
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{statusLabel(displayStatus)}</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{formatIDR(o.grand_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>}
      </Card>
    </DashboardShell>
  );
}
