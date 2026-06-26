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
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");

      if (rolesError) {
        throw new Error(rolesError.message);
      }

      const customerIds = roles?.map((r) => r.user_id) ?? [];
      if (customerIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", customerIds)
        .order("created_at", { ascending: false });

      if (profilesError) {
        throw new Error(profilesError.message);
      }

      return profiles ?? [];
    },
  });
  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader eyebrow="Pelanggan" title="Daftar Pelanggan" />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Memuat data pelanggan...</p>
        ) : q.isError ? (
          <div className="text-sm text-destructive p-4 border border-destructive/20 bg-destructive/10 rounded-md">
            <p className="font-semibold">Gagal memuat data pelanggan:</p>
            <p className="mt-1 font-mono text-xs">
              {q.error instanceof Error ? q.error.message : String(q.error)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Catatan: Pastikan Anda telah menjalankan baris SQL RLS kebijakan untuk admin di
              Supabase SQL Editor.
            </p>
          </div>
        ) : q.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                  <th className="py-2">Nama</th>
                  <th>Email</th>
                  <th>HP</th>
                  <th>Kota</th>
                  <th>Bergabung</th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-3 font-semibold">{p.nama_lengkap || "—"}</td>
                    <td>{p.email}</td>
                    <td className="text-xs">{p.no_hp || "—"}</td>
                    <td className="text-xs">{p.kota || "—"}</td>
                    <td className="text-xs">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada pelanggan.</p>
        )}
      </Card>
    </DashboardShell>
  );
}
