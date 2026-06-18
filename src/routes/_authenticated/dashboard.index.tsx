import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { formatIDR, statusLabel } from "@/lib/format";

export const CUSTOMER_NAV = [
  { label: "Dashboard", to: "/dashboard" },
  { label: "Pesanan Saya", to: "/dashboard/pesanan" },
  { label: "Wishlist", to: "/dashboard/wishlist" },
  { label: "Profil Saya", to: "/dashboard/profil" },
];

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["dash", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [orders, wl] = await Promise.all([
        supabase.from("orders").select("id, order_number, status, grand_total, created_at, payments(status)").eq("user_id", user!.id).order("created_at", { ascending: false }),
        supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      ]);
      const all = orders.data ?? [];
      const active = all.filter((o) => !["delivered", "cancelled"].includes(o.status));
      return { all, active, last: all[0], wlCount: wl.count ?? 0 };
    },
  });

  const lastPayment = q.data?.last ? (Array.isArray(q.data.last.payments) ? q.data.last.payments[0] : q.data.last.payments as any) : null;
  const lastDisplayStatus = q.data?.last
    ? ((q.data.last.status === "pending" && lastPayment?.status === "waiting_verification") ? "waiting_verification" : q.data.last.status)
    : "—";

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader eyebrow="Dashboard" title={`Halo, ${user?.email ?? ""}`} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><div className="eyebrow text-muted-foreground">Total Pesanan</div><div className="display-md mt-2">{q.data?.all.length ?? 0}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Pesanan Aktif</div><div className="display-md mt-2">{q.data?.active.length ?? 0}</div></Card>
        <Card><div className="eyebrow text-muted-foreground">Wishlist</div><div className="display-md mt-2">{q.data?.wlCount ?? 0}</div></Card>
        <Card>
          <div className="eyebrow text-muted-foreground">Status Terakhir</div>
          <div className="text-base font-semibold mt-2">{q.data?.last ? statusLabel(lastDisplayStatus) : "—"}</div>
          {q.data?.last && <Link to="/dashboard/pesanan/$orderNumber" params={{ orderNumber: q.data.last.order_number }} className="text-xs text-primary mt-2 inline-block">Lihat detail →</Link>}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-extrabold text-lg mb-4">Pesanan Terakhir</h2>
        {q.data?.all.length ? (
          <table className="w-full text-sm">
            <thead><tr className="eyebrow text-muted-foreground text-left border-b border-border"><th className="py-2">Order</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {q.data.all.slice(0, 5).map((o) => {
                const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments as any;
                const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
                  ? "waiting_verification"
                  : o.status;
                return (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-2"><Link to="/dashboard/pesanan/$orderNumber" params={{ orderNumber: o.order_number }} className="font-mono text-xs hover:underline">{o.order_number}</Link></td>
                    <td className="text-xs">{statusLabel(displayStatus)}</td>
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
