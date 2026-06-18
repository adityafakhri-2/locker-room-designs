import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { formatIDR, formatDate, statusLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/admin/pesanan/")({
  component: AdminOrders,
});

function AdminOrders() {
  const q = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => (await supabase.from("orders").select("*, payments(status), profiles!orders_user_id_fkey(email, nama_lengkap)").order("created_at", { ascending: false })).data ?? [],
  });

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Pesanan" title="Manajemen Pesanan" />
      <Card>
        {q.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border">
                <th className="py-2">Order</th><th>Tanggal</th><th>Pelanggan</th><th>Status</th><th>Bayar</th><th className="text-right">Total</th>
              </tr></thead>
              <tbody>
                {q.data.map((o) => {
                  const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments as any;
                  const profile = o.profiles as any;
                  return (
                    <tr key={o.id} className="border-b border-border/50">
                      <td className="py-3"><Link to="/admin/pesanan/$orderNumber" params={{ orderNumber: o.order_number }} className="font-mono text-xs text-primary hover:underline">{o.order_number}</Link></td>
                      <td className="text-xs">{formatDate(o.created_at)}</td>
                      <td className="text-xs">{profile?.nama_lengkap || profile?.email || "—"}</td>
                      <td className="text-xs">{statusLabel(o.status)}</td>
                      <td className="text-xs">{payment ? statusLabel(payment.status) : "—"}</td>
                      <td className="text-right tabular-nums">{formatIDR(o.grand_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">Belum ada pesanan masuk.</p>}
      </Card>
    </DashboardShell>
  );
}
