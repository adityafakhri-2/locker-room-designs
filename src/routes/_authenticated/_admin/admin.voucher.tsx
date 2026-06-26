import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { ADMIN_NAV } from "./admin.index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/format";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { CustomRadioGroup } from "@/components/ui/custom-radio-group";
import { 
  Ticket, 
  Trash2, 
  Plus, 
  Search, 
  Calendar, 
  Users, 
  Percent, 
  DollarSign, 
  ToggleLeft, 
  ToggleRight,
  Pencil
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/voucher")({
  component: AdminVouchers,
});

function AdminVouchers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"nominal" | "percentage">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [minPurchase, setMinPurchase] = useState("0");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [usageLimit, setUsageLimit] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addVoucher = useMutation({
    mutationFn: async () => {
      if (!code) throw new Error("Kode voucher harus diisi!");
      if (!discountValue || Number(discountValue) <= 0) throw new Error("Nilai diskon harus lebih besar dari 0!");
      
      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_purchase: Number(minPurchase || 0),
        max_discount: discountType === "percentage" && maxDiscount ? Number(maxDiscount) : null,
        start_date: startDate ? startDate.toISOString() : new Date().toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        status: status,
      };

      const { error } = await supabase.from("vouchers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voucher berhasil ditambahkan");
      setShowAddForm(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateVoucher = useMutation({
    mutationFn: async () => {
      if (!editingVoucherId) return;
      if (!code) throw new Error("Kode voucher harus diisi!");
      if (!discountValue || Number(discountValue) <= 0) throw new Error("Nilai diskon harus lebih besar dari 0!");

      const payload = {
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: Number(discountValue),
        min_purchase: Number(minPurchase || 0),
        max_discount: discountType === "percentage" && maxDiscount ? Number(maxDiscount) : null,
        start_date: startDate ? startDate.toISOString() : new Date().toISOString(),
        end_date: endDate ? endDate.toISOString() : null,
        usage_limit: usageLimit ? parseInt(usageLimit, 10) : null,
        status: status,
      };

      const { error } = await supabase
        .from("vouchers")
        .update(payload)
        .eq("id", editingVoucherId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voucher berhasil diperbarui");
      setShowAddForm(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const nextStatus = currentStatus === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("vouchers")
        .update({ status: nextStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status voucher diperbarui");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteVoucher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vouchers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voucher berhasil dihapus");
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinPurchase("0");
    setMaxDiscount("");
    setStartDate(undefined);
    setEndDate(undefined);
    setUsageLimit("");
    setStatus("active");
    setEditingVoucherId(null);
  };

  const startEdit = (v: typeof vouchers[0]) => {
    setEditingVoucherId(v.id);
    setCode(v.code);
    setDiscountType(v.discount_type as "nominal" | "percentage");
    setDiscountValue(String(v.discount_value));
    setMinPurchase(String(v.min_purchase));
    setMaxDiscount(v.max_discount ? String(v.max_discount) : "");
    setStartDate(v.start_date ? new Date(v.start_date) : undefined);
    setEndDate(v.end_date ? new Date(v.end_date) : undefined);
    setUsageLimit(v.usage_limit ? String(v.usage_limit) : "");
    setStatus(v.status as "active" | "inactive");
    setShowAddForm(true);
  };

  const filteredVouchers = vouchers.filter((v) =>
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const getVoucherStatus = (v: typeof vouchers[0]) => {
    const now = new Date();
    const isExpired = v.end_date ? new Date(v.end_date) < now : false;
    const isLimitReached = v.usage_limit ? v.usage_count >= v.usage_limit : false;

    if (isExpired) {
      return { label: "Kadaluarsa", color: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50" };
    }
    if (isLimitReached) {
      return { label: "Kuota Habis", color: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50" };
    }
    if (v.status === "inactive") {
      return { label: "Non-aktif", color: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400 dark:border-gray-700/50" };
    }
    return { label: "Aktif", color: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50" };
  };

  return (
    <DashboardShell items={ADMIN_NAV} title="Admin Panel">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <PageHeader eyebrow="Voucher" title="Manajemen Voucher Toko" />
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="sm:self-end cursor-pointer flex items-center gap-2"
        >
          {showAddForm ? "Batal" : <><Plus className="size-4" /> Tambah Voucher</>}
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6 border-primary/20 bg-primary/5 transition-all">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Ticket className="size-5 text-primary" /> {editingVoucherId ? `Edit Voucher: ${code}` : "Buat Voucher Baru"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="v-code">Kode Voucher</Label>
              <Input 
                id="v-code" 
                placeholder="misal: WELCOME10" 
                value={code} 
                onChange={(e) => setCode(e.target.value.toUpperCase())} 
              />
              <p className="text-[10px] text-muted-foreground">Teks unik yang dimasukkan pelanggan saat checkout.</p>
            </div>

            <div className="space-y-1">
              <Label>Tipe Diskon</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={discountType === "percentage" ? "default" : "outline"}
                  onClick={() => setDiscountType("percentage")}
                  className="cursor-pointer text-xs"
                >
                  <Percent className="size-3.5 mr-1" /> Persentase (%)
                </Button>
                <Button
                  type="button"
                  variant={discountType === "nominal" ? "default" : "outline"}
                  onClick={() => setDiscountType("nominal")}
                  className="cursor-pointer text-xs"
                >
                  <DollarSign className="size-3.5 mr-1" /> Nominal (Rupiah)
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="v-value">Nilai Diskon</Label>
              <Input 
                id="v-value" 
                type="number" 
                placeholder={discountType === "percentage" ? "10 (%)" : "20000 (Rp)"} 
                value={discountValue} 
                onChange={(e) => setDiscountValue(e.target.value)} 
              />
            </div>

            {discountType === "percentage" && (
              <div className="space-y-1">
                <Label htmlFor="v-max">Maksimal Diskon (Cap)</Label>
                <Input 
                  id="v-max" 
                  type="number" 
                  placeholder="misal: 15000 (Kosongkan jika tidak dibatasi)" 
                  value={maxDiscount} 
                  onChange={(e) => setMaxDiscount(e.target.value)} 
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="v-min">Minimum Belanja (Rp)</Label>
              <Input 
                id="v-min" 
                type="number" 
                placeholder="misal: 50000" 
                value={minPurchase} 
                onChange={(e) => setMinPurchase(e.target.value)} 
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="v-limit">Batas Total Klaim (Kuota)</Label>
              <Input 
                id="v-limit" 
                type="number" 
                placeholder="misal: 100 (Kosongkan jika tidak terbatas)" 
                value={usageLimit} 
                onChange={(e) => setUsageLimit(e.target.value)} 
              />
            </div>

            <div className="space-y-1">
              <Label>Waktu Mulai Berlaku</Label>
              <DateTimePicker 
                value={startDate} 
                onChange={setStartDate} 
                placeholder="Pilih waktu mulai"
              />
            </div>

            <div className="space-y-1">
              <Label>Waktu Berakhir (Expired)</Label>
              <DateTimePicker 
                value={endDate} 
                onChange={setEndDate} 
                placeholder="Pilih waktu berakhir"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label className="mb-2 block">Status Awal</Label>
              <CustomRadioGroup
                value={status}
                onChange={(val) => setStatus(val as "active" | "inactive")}
                options={[
                  { label: "Aktif", value: "active" },
                  { label: "Non-aktif", value: "inactive" }
                ]}
                name="initial-status"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { setShowAddForm(false); resetForm(); }}
              className="cursor-pointer"
            >
              Batal
            </Button>
            <Button 
              type="button" 
              onClick={() => editingVoucherId ? updateVoucher.mutate() : addVoucher.mutate()} 
              disabled={editingVoucherId ? updateVoucher.isPending : addVoucher.isPending}
              className="cursor-pointer"
            >
              {editingVoucherId 
                ? (updateVoucher.isPending ? "Memperbarui..." : "Perbarui Voucher") 
                : (addVoucher.isPending ? "Menyimpan..." : "Simpan Voucher")
              }
            </Button>
          </div>
        </Card>
      )}

      {/* List / Table section */}
      <Card>
        <div className="flex items-center gap-2 mb-4 max-w-sm border border-border rounded-md px-3 py-1 bg-background">
          <Search className="size-4 text-muted-foreground flex-shrink-0" />
          <input 
            type="text" 
            placeholder="Cari kode voucher..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-0 outline-none text-sm py-1"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Memuat data voucher...</p>
        ) : filteredVouchers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left eyebrow text-muted-foreground border-b border-border">
                  <th className="py-3 px-2">Voucher</th>
                  <th className="py-3 px-2">Potongan</th>
                  <th className="py-3 px-2">Syarat & Kuota</th>
                  <th className="py-3 px-2 text-center">Status</th>
                  <th className="py-3 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredVouchers.map((v) => {
                  const statusInfo = getVoucherStatus(v);
                  return (
                    <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20 transition-all">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <Ticket className="size-4 text-primary flex-shrink-0" />
                          <div>
                            <span className="font-mono font-bold text-sm bg-accent px-2 py-0.5 rounded border border-border">
                              {v.code}
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="size-3" />
                              <span>
                                {new Date(v.start_date).toLocaleDateString("id-ID", { dateStyle: "short" })} 
                                {v.end_date ? ` - ${new Date(v.end_date).toLocaleDateString("id-ID", { dateStyle: "short" })}` : " (Selamanya)"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-semibold text-sm">
                          {v.discount_type === "percentage" 
                            ? `${v.discount_value}%` 
                            : formatIDR(v.discount_value)
                          }
                        </div>
                        {v.discount_type === "percentage" && v.max_discount && (
                          <div className="text-[10px] text-muted-foreground">
                            Maks. {formatIDR(v.max_discount)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs">
                          Min. Belanja: <span className="font-medium">{formatIDR(v.min_purchase)}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="size-3" />
                          <span>
                            Klaim: {v.usage_count} / {v.usage_limit ?? "∞"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(v)}
                            title="Edit Voucher"
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus.mutate({ id: v.id, currentStatus: v.status })}
                            disabled={toggleStatus.isPending}
                            title={v.status === "active" ? "Nonaktifkan Voucher" : "Aktifkan Voucher"}
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors p-1"
                          >
                            {v.status === "active" ? (
                              <ToggleRight className="size-6 text-primary" />
                            ) : (
                              <ToggleLeft className="size-6" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus voucher ${v.code}?`)) {
                                deleteVoucher.mutate(v.id);
                              }
                            }}
                            disabled={deleteVoucher.isPending}
                            className="text-destructive hover:text-red-700 cursor-pointer transition-colors p-1"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-6 text-center">Tidak ada voucher ditemukan.</p>
        )}
      </Card>
    </DashboardShell>
  );
}
