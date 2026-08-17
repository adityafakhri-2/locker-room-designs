import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "@/lib/navigation";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  UserX,
  Users,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/_admin/admin/pelanggan")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<"nama" | "email" | "kota" | "created_at">("created_at");
  const [sortAsc, setSortAsc] = useState(false);

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

  const deleteMutation = useMutation({
    mutationFn: async (userIds: string[]) => {
      // Try RPC first for clean atomic batch delete
      const { error: rpcError } = await supabase.rpc("admin_delete_customers", {
        customer_ids: userIds,
      });

      // If RPC doesn't exist yet, fallback to direct table deletion
      if (rpcError) {
        await supabase.from("wishlists").delete().in("user_id", userIds);
        await supabase.from("cart_items").delete().in("user_id", userIds);
        await supabase.from("addresses").delete().in("user_id", userIds);
        await supabase
          .from("user_roles")
          .delete()
          .in("user_id", userIds)
          .eq("role", "customer");
        const { error: profError } = await supabase
          .from("profiles")
          .delete()
          .in("id", userIds);

        if (profError) throw profError;
      }
    },
    onSuccess: (_, userIds) => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats-profit"] });
      queryClient.invalidateQueries({ queryKey: ["report-customers"] });
      setSelectedIds((prev) => prev.filter((id) => !userIds.includes(id)));
      setDeleteConfirmOpen(false);
      setTargetDeleteIds([]);
      toast.success(
        userIds.length > 1
          ? `Berhasil menghapus ${userIds.length} pelanggan`
          : "Berhasil menghapus data pelanggan",
      );
    },
    onError: (err: any) => {
      toast.error(`Gagal menghapus pelanggan: ${err.message || "Terjadi kesalahan"}`);
    },
  });

  const filteredAndSorted = useMemo(() => {
    let list = q.data ? [...q.data] : [];

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.nama_lengkap && p.nama_lengkap.toLowerCase().includes(s)) ||
          (p.email && p.email.toLowerCase().includes(s)) ||
          (p.no_hp && p.no_hp.includes(s)) ||
          (p.kota && p.kota.toLowerCase().includes(s)),
      );
    }

    list.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortField === "nama") {
        valA = (a.nama_lengkap || "").toLowerCase();
        valB = (b.nama_lengkap || "").toLowerCase();
      } else if (sortField === "email") {
        valA = (a.email || "").toLowerCase();
        valB = (b.email || "").toLowerCase();
      } else if (sortField === "kota") {
        valA = (a.kota || "").toLowerCase();
        valB = (b.kota || "").toLowerCase();
      } else if (sortField === "created_at") {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [q.data, search, sortField, sortAsc]);

  function handleSort(field: "nama" | "email" | "kota" | "created_at") {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(filteredAndSorted.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  }

  function handleSelectRow(id: string, checked: boolean) {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    }
  }

  function handleDeleteSingle(id: string) {
    setTargetDeleteIds([id]);
    setDeleteConfirmOpen(true);
  }

  function handleDeleteBulk() {
    if (selectedIds.length === 0) return;
    setTargetDeleteIds(selectedIds);
    setDeleteConfirmOpen(true);
  }

  const isAllSelected =
    filteredAndSorted.length > 0 &&
    filteredAndSorted.every((p) => selectedIds.includes(p.id));
  const isSomeSelected =
    selectedIds.length > 0 && !isAllSelected;

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <PageHeader
        eyebrow="Pelanggan"
        title="Daftar Pelanggan"
        action={
          selectedIds.length > 0 ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteBulk}
              disabled={deleteMutation.isPending}
              className="gap-1.5 font-semibold shadow-sm"
            >
              <Trash2 className="size-4" />
              <span>Hapus Terpilih ({selectedIds.length})</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-md border border-border">
              <Users className="size-4 text-primary" />
              <span>
                Total: <strong className="text-foreground">{q.data?.length ?? 0}</strong> Pelanggan
              </span>
            </div>
          )
        }
      />

      <Card>
        {/* Search Bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, email, nomor HP, atau kota..."
              className="pl-9 pr-9 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="text-xs text-muted-foreground font-medium hidden sm:block">
              {selectedIds.length} pelanggan dipilih
            </div>
          )}
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
            Memuat data pelanggan...
          </p>
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
        ) : filteredAndSorted.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left eyebrow text-muted-foreground border-b border-border select-none">
                  {/* Select All Checkbox */}
                  <th className="py-2.5 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer align-middle"
                    />
                  </th>
                  <th
                    className="py-2.5 pr-4 cursor-pointer hover:text-foreground group"
                    onClick={() => handleSort("nama")}
                  >
                    <div className="flex items-center gap-1">
                      Nama
                      {sortField === "nama" ? (
                        sortAsc ? (
                          <ArrowUp className="size-3 text-primary" />
                        ) : (
                          <ArrowDown className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-2.5 pr-4 cursor-pointer hover:text-foreground group"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      {sortField === "email" ? (
                        sortAsc ? (
                          <ArrowUp className="size-3 text-primary" />
                        ) : (
                          <ArrowDown className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 pr-4">HP</th>
                  <th
                    className="py-2.5 pr-4 cursor-pointer hover:text-foreground group"
                    onClick={() => handleSort("kota")}
                  >
                    <div className="flex items-center gap-1">
                      Kota
                      {sortField === "kota" ? (
                        sortAsc ? (
                          <ArrowUp className="size-3 text-primary" />
                        ) : (
                          <ArrowDown className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th
                    className="py-2.5 pr-4 cursor-pointer hover:text-foreground group"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center gap-1">
                      Bergabung
                      {sortField === "created_at" ? (
                        sortAsc ? (
                          <ArrowUp className="size-3 text-primary" />
                        ) : (
                          <ArrowDown className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-30 group-hover:opacity-75 transition-opacity" />
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 pr-3 text-right w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((p) => {
                  const isChecked = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`border-b border-border/50 transition-colors ${
                        isChecked ? "bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectRow(p.id, e.target.checked)}
                          className="rounded border-border size-4 text-primary focus:ring-primary cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-3 pr-4 font-semibold text-xs sm:text-sm">
                        {p.nama_lengkap || "—"}
                      </td>
                      <td className="pr-4 text-xs font-mono">{p.email}</td>
                      <td className="text-xs pr-4 text-muted-foreground">{p.no_hp || "—"}</td>
                      <td className="text-xs pr-4">{p.kota || "—"}</td>
                      <td className="text-xs pr-4 text-muted-foreground">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(p.id)}
                          title="Hapus Pelanggan"
                          className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
        ) : (
          <div className="py-12 text-center">
            <UserX className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold">Tidak ada pelanggan ditemukan</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search
                ? `Tidak ada hasil pencarian untuk "${search}".`
                : "Belum ada pelanggan terdaftar di toko Anda."}
            </p>
          </div>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {targetDeleteIds.length > 1
                ? `Hapus ${targetDeleteIds.length} Pelanggan Terpilih?`
                : "Hapus Pelanggan Ini?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {targetDeleteIds.length > 1
                ? `Tindakan ini akan menghapus data profil dan hak akses dari ${targetDeleteIds.length} pelanggan yang dipilih. Tindakan ini tidak dapat dibatalkan.`
                : "Tindakan ini akan menghapus data profil pelanggan dan hak akses pelanggan ini. Tindakan ini tidak dapat dibatalkan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(targetDeleteIds);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

