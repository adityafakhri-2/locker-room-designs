import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "./dashboard.index";
import { formatIDR, formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/pesanan/")({
  component: OrdersPage,
});

function OrdersPage() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      await supabase.rpc("check_and_cancel_expired_orders");
      return (await supabase.from("orders").select("*, payments(status)").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [];
    },
  });

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader eyebrow="Pesanan" title="Pesanan Saya" />
      <Card>
        {q.data?.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border"><th className="py-2">Order</th><th>Tanggal</th><th>Status</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {q.data.map((o) => {
                const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments as any;
                const displayStatus = (o.status === "pending" && payment?.status === "waiting_verification")
                  ? "waiting_verification"
                  : o.status;
                return (
                  <tr key={o.id} className="border-b border-border/50">
                    <td className="py-3"><Link to="/dashboard/pesanan/$orderNumber" params={{ orderNumber: o.order_number }} className="font-mono text-xs hover:underline text-primary">{o.order_number}</Link></td>
                    <td className="text-xs">{formatDate(o.created_at)}</td>
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
