import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { formatIDR, formatDate, statusLabel } from "@/lib/format";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/_admin/admin/pesanan/")({
  component: AdminOrders,
});

function AdminOrders() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const q = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      await supabase.rpc("check_and_cancel_expired_orders");
      const [ordersRes, profilesRes] = await Promise.all([
        supabase.from("orders").select("*, payments(status)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, email, nama_lengkap")
      ]);
      if (ordersRes.error) {
        throw new Error(ordersRes.error.message);
      }
      if (profilesRes.error) {
        throw new Error(profilesRes.error.message);
      }
      const orders = ordersRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      return orders.map(o => ({
        ...o,
        profiles: profileMap.get(o.user_id) || null
      }));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("orders").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pesanan berhasil dihapus");
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err: any) => {
      toast.error("Gagal menghapus pesanan: " + err.message);
    }
  });

  function handleDeleteSingle(id: string) {
    setDeleteIds([id]);
    setDeleteConfirmOpen(true);
  }

  function handleDeleteBulk() {
    setDeleteIds(selectedIds);
    setDeleteConfirmOpen(true);
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(x => x !== id));
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked && q.data) {
      setSelectedIds(q.data.map(o => o.id));
    } else {
      setSelectedIds([]);
    }
  }

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Pesanan"
        title="Manajemen Pesanan"
        action={
          selectedIds.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteBulk}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-4 mr-1.5" /> Hapus Terpilih ({selectedIds.length})
            </Button>
          )
        }
      />
      <Card>
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Memuat data pesanan...</p>
        ) : q.isError ? (
          <div className="text-sm text-destructive p-4 border border-destructive/20 bg-destructive/10 rounded-md">
            <p className="font-semibold">Gagal memuat data pesanan:</p>
            <p className="mt-1 font-mono text-xs">{q.error instanceof Error ? q.error.message : String(q.error)}</p>
          </div>
        ) : q.data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                  <th className="py-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={q.data ? selectedIds.length === q.data.length && q.data.length > 0 : false}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer"
                    />
                  </th>
                  <th className="py-2">Order</th>
                  <th>Tanggal</th>
                  <th>Pelanggan</th>
                  <th>Status</th>
                  <th>Bayar</th>
                  <th className="text-right">Total</th>
                  <th className="w-12 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {q.data.map((o) => {
                  const payment = Array.isArray(o.payments) ? o.payments[0] : o.payments as any;
                  const profile = o.profiles as any;
                  const isSelected = selectedIds.includes(o.id);
                  return (
                    <tr key={o.id} className="border-b border-border/50 hover:bg-muted/10 transition-colors">
                      <td className="py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(o.id, e.target.checked)}
                          className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer"
                        />
                      </td>
                      <td className="py-3">
                        <Link
                          to="/admin/pesanan/$orderNumber"
                          params={{ orderNumber: o.order_number }}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {o.order_number}
                        </Link>
                      </td>
                      <td className="text-xs">{formatDate(o.created_at)}</td>
                      <td className="text-xs">{profile?.nama_lengkap || profile?.email || "—"}</td>
                      <td className="text-xs">{statusLabel(o.status)}</td>
                      <td className="text-xs">{payment ? statusLabel(payment.status) : "—"}</td>
                      <td className="text-right tabular-nums font-semibold">{formatIDR(o.grand_total)}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleDeleteSingle(o.id)}
                          className="text-destructive hover:opacity-70 transition-opacity"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted-foreground">Belum ada pesanan masuk.</p>}
      </Card>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Pesanan</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIds.length > 1
                ? `Apakah Anda yakin ingin menghapus ${deleteIds.length} pesanan terpilih beserta seluruh data terkait pembayaran dan pengiriman? Tindakan ini tidak dapat dibatalkan.`
                : "Apakah Anda yakin ingin menghapus pesanan ini beserta seluruh data terkait pembayaran dan pengiriman? Tindakan ini tidak dapat dibatalkan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                deleteMutation.mutate(deleteIds);
                setDeleteConfirmOpen(false);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}
