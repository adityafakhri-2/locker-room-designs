import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/_admin/admin/pelanggan")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const q = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Pelanggan" title="Daftar Pelanggan" />
      <Card>
        {q.data?.length ? (
          <table className="w-full text-sm">
            <thead><tr className="text-left eyebrow text-muted-foreground border-b border-border"><th className="py-2">Nama</th><th>Email</th><th>HP</th><th>Kota</th><th>Bergabung</th></tr></thead>
            <tbody>
              {q.data.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-3 font-semibold">{p.nama_lengkap || "—"}</td>
                  <td>{p.email}</td><td className="text-xs">{p.no_hp || "—"}</td><td className="text-xs">{p.kota || "—"}</td>
                  <td className="text-xs">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Belum ada pelanggan.</p>}
      </Card>
    </DashboardShell>
  );
}
