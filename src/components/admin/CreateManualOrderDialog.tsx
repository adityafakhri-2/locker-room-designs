import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatIDR } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Receipt,
  Coins,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Calendar,
  User,
  Phone,
  Shirt,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { OrderReceiptModal, OrderReceiptData } from "@/components/commerce/OrderReceiptModal";

interface OrderItemRow {
  productId: string;
  productName: string;
  productSlug?: string;
  coverImage?: string | null;
  size: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  availableSizes: string[];
  sizeStockMap: Record<string, number>;
  totalStock: number;
}

export function CreateManualOrderDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Form State
  const [recipientName, setRecipientName] = useState("Pelanggan Toko (Walk-in)");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "qris">("cash");
  const [transactionDate, setTransactionDate] = useState(() => {
    const now = new Date();
    // Format YYYY-MM-DDTHH:mm
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [notes, setNotes] = useState("Transaksi Langsung di Outlet Cimahi");

  // Items State
  const [items, setItems] = useState<OrderItemRow[]>([
    {
      productId: "",
      productName: "",
      size: "",
      quantity: 1,
      unitPrice: 0,
      costPrice: 0,
      availableSizes: [],
      sizeStockMap: {},
      totalStock: 0,
    },
  ]);

  // Created Receipt Modal State
  const [createdOrderForReceipt, setCreatedOrderForReceipt] = useState<OrderReceiptData | null>(
    null,
  );
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Fetch Available Products
  const productsQuery = useQuery({
    queryKey: ["products-for-manual-order"],
    enabled: isOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, slug, name, price, cost_price, cover_image_url, sizes, size_stock, stock, is_active",
        )
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const allProducts = productsQuery.data ?? [];

  // Update item row when selecting product
  const handleSelectProduct = (index: number, productId: string) => {
    const p = allProducts.find((item) => item.id === productId);
    if (!p) return;

    const sizes = p.sizes ?? [];
    const sizeStock = (p.size_stock as Record<string, number> | null) ?? {};
    // Default pick first available size or first size
    const firstAvailableSize = sizes.find((s) => (sizeStock[s] ?? p.stock) > 0) || sizes[0] || "All Size";

    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        productId: p.id,
        productName: p.name,
        productSlug: p.slug,
        coverImage: p.cover_image_url,
        size: firstAvailableSize,
        quantity: 1,
        unitPrice: Number(p.price) || 0,
        costPrice: Number((p as any).cost_price) || 0,
        availableSizes: sizes,
        sizeStockMap: sizeStock,
        totalStock: p.stock ?? 0,
      };
      return updated;
    });
  };

  const handleUpdateItem = <K extends keyof OrderItemRow>(
    index: number,
    field: K,
    val: OrderItemRow[K],
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        size: "",
        quantity: 1,
        unitPrice: 0,
        costPrice: 0,
        availableSizes: [],
        sizeStockMap: {},
        totalStock: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Pesanan minimal memiliki 1 item jersey!");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial Calculations
  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
    0,
  );
  const totalCostPrice = items.reduce(
    (sum, it) => sum + (Number(it.costPrice) || 0) * (Number(it.quantity) || 1),
    0,
  );
  const grandTotal = Math.max(0, subtotal + Number(shippingCost || 0) - Number(discountAmount || 0));
  const estimatedProfit = subtotal - Number(discountAmount || 0) - totalCostPrice;
  const marginPercent = subtotal > 0 ? (estimatedProfit / subtotal) * 100 : 0;

  // Submit Mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Validate
      if (!recipientName.trim()) {
        throw new Error("Nama pembeli / pelanggan wajib diisi!");
      }
      const validItems = items.filter((it) => it.productId && it.quantity > 0);
      if (validItems.length === 0) {
        throw new Error("Pilih minimal 1 jersey yang dibeli!");
      }

      // Generate Order Number: POS-YYYYMMDD-XXXX
      const dateObj = new Date(transactionDate || Date.now());
      const ymd = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `POS-${ymd}-${rand}`;

      const paymentBankLabel =
        paymentMethod === "cash"
          ? "Tunai / Cash Toko"
          : paymentMethod === "qris"
            ? "QRIS Toko"
            : "Transfer Bank";

      // 1. Insert into orders table
      const orderPayload: any = {
        order_number: orderNumber,
        user_id: user?.id || "00000000-0000-0000-0000-000000000000",
        recipient_name: recipientName.trim(),
        recipient_no_hp: phone.trim() || "-",
        recipient_alamat: "Outlet AA Jersey / Pembelian Langsung",
        recipient_kota: "Kota Cimahi",
        recipient_provinsi: "Jawa Barat",
        recipient_kode_pos: "40523",
        subtotal: subtotal,
        shipping_cost: Number(shippingCost) || 0,
        discount_amount: Number(discountAmount) || 0,
        grand_total: grandTotal,
        status: "delivered", // Offline orders are fulfilled immediately
        note: notes.trim() || `Transaksi Manual / Kasir (${paymentBankLabel})`,
        created_at: new Date(transactionDate).toISOString(),
        updated_at: new Date(transactionDate).toISOString(),
      };

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload)
        .select()
        .single();

      if (orderError) throw new Error("Gagal membuat pesanan: " + orderError.message);

      // 2. Insert into order_items table
      const orderItemsPayload = validItems.map((it) => ({
        order_id: newOrder.id,
        product_id: it.productId,
        product_name: it.productName,
        product_slug: it.productSlug || null,
        size: it.size || "All Size",
        quantity: it.quantity,
        unit_price: it.unitPrice,
        cost_price: it.costPrice,
        subtotal: it.unitPrice * it.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItemsPayload);

      if (itemsError) throw new Error("Gagal menyimpan item produk: " + itemsError.message);

      // 3. Insert into payments table
      const paymentPayload: any = {
        order_id: newOrder.id,
        amount: grandTotal,
        status: "approved",
        payment_type: paymentMethod,
        bank: paymentBankLabel,
        verified_at: new Date(transactionDate).toISOString(),
        created_at: new Date(transactionDate).toISOString(),
        updated_at: new Date(transactionDate).toISOString(),
      };

      const { error: paymentError } = await supabase.from("payments").insert(paymentPayload);
      if (paymentError) {
        console.warn("Payment log insert warning:", paymentError.message);
      }

      // 4. Deduct product stocks
      for (const it of validItems) {
        try {
          const { data: prodData } = await supabase
            .from("products")
            .select("stock, size_stock, sold_count")
            .eq("id", it.productId)
            .single();

          if (prodData) {
            const curStock = Number(prodData.stock) || 0;
            const newStock = Math.max(0, curStock - it.quantity);
            const curSoldCount = Number(prodData.sold_count) || 0;
            const newSoldCount = curSoldCount + it.quantity;

            const curSizeStock = (prodData.size_stock as Record<string, number> | null) ?? {};
            const updatedSizeStock = { ...curSizeStock };
            if (it.size && updatedSizeStock[it.size] !== undefined) {
              updatedSizeStock[it.size] = Math.max(0, Number(updatedSizeStock[it.size]) - it.quantity);
            }

            await supabase
              .from("products")
              .update({
                stock: newStock,
                size_stock: updatedSizeStock,
                sold_count: newSoldCount,
              })
              .eq("id", it.productId);
          }
        } catch (e) {
          console.error("Failed to update product stock:", e);
        }
      }

      return {
        ...newOrder,
        payments: [paymentPayload],
        order_items: orderItemsPayload,
      };
    },
    onSuccess: (createdOrder) => {
      toast.success(`Transaksi ${createdOrder.order_number} berhasil dicatat & masuk pembukuan!`);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats-profit"] });
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-for-manual-order"] });

      // Open receipt modal
      setCreatedOrderForReceipt(createdOrder as any);
      setReceiptModalOpen(true);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Gagal menyimpan transaksi manual");
    },
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <div className="p-5 border-b border-border bg-card">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Catat Transaksi Manual / Kasir POS (Offline)
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Catat pesanan offline dari outlet Cimahi, WhatsApp, atau event. Otomatis masuk laporan keuangan & memotong stok inventaris.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Bagian 1: Data Pembeli & Info Transaksi */}
            <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <User className="size-3.5 text-primary" />
                  Nama Pembeli / Pelanggan *
                </Label>
                <Input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Contoh: Budi Santoso / Pembeli Toko"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <Phone className="size-3.5 text-primary" />
                  No. WhatsApp / HP (Opsional)
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  Tanggal & Waktu Transaksi *
                </Label>
                <Input
                  type="datetime-local"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <CreditCard className="size-3.5 text-primary" />
                  Metode Pembayaran *
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val: any) => setPaymentMethod(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Tunai / Cash (Kasir)</SelectItem>
                    <SelectItem value="bank_transfer">🏦 Transfer Bank (BCA/Mandiri/BRI)</SelectItem>
                    <SelectItem value="qris">📱 QRIS / E-Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bagian 2: Daftar Jersey yang Dibeli */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Shirt className="size-4 text-primary" />
                  Jersey yang Dibeli ({items.length} Item)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddItem}
                  className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
                >
                  <Plus className="size-3.5" />
                  Tambah Jersey
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-border bg-card shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-xs font-bold text-muted-foreground pt-1">
                        #{idx + 1}
                      </span>

                      {/* Pilih Produk */}
                      <div className="flex-1 min-w-[200px]">
                        <Select
                          value={item.productId}
                          onValueChange={(pId) => handleSelectProduct(idx, pId)}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Pilih Jersey dari Katalog..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {allProducts.map((prod) => (
                              <SelectItem key={prod.id} value={prod.id}>
                                {prod.name} — {formatIDR(prod.price)} (Stok: {prod.stock} pcs)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Tombol Hapus Baris */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                        title="Hapus jersey ini"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    {/* Baris Detail Ukuran, Qty, Harga Satuan, & Subtotal */}
                    {item.productId && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/50 text-xs">
                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">
                            Pilih Ukuran
                          </Label>
                          <Select
                            value={item.size}
                            onValueChange={(sz) => handleUpdateItem(idx, "size", sz)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {item.availableSizes.map((s) => {
                                const sizeRemaining = item.sizeStockMap[s] ?? item.totalStock;
                                return (
                                  <SelectItem key={s} value={s}>
                                    Size {s} ({sizeRemaining} pcs)
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">
                            Jumlah (Qty)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(
                                idx,
                                "quantity",
                                Math.max(1, parseInt(e.target.value) || 1),
                              )
                            }
                            className="h-8 text-xs font-mono font-semibold"
                          />
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">
                            Harga Satuan (Rp)
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItem(
                                idx,
                                "unitPrice",
                                Math.max(0, parseInt(e.target.value) || 0),
                              )
                            }
                            className="h-8 text-xs font-mono font-semibold"
                          />
                        </div>

                        <div>
                          <Label className="text-[11px] text-muted-foreground block mb-1">
                            Subtotal
                          </Label>
                          <div className="h-8 px-2 rounded border border-border bg-muted/40 flex items-center font-bold font-mono text-xs text-foreground">
                            {formatIDR(item.unitPrice * item.quantity)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bagian 3: Diskon, Ongkir & Catatan */}
            <div className="grid sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/20 border border-border">
              <div>
                <Label className="text-xs font-semibold block mb-1.5">
                  Potongan Diskon (Rp)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={discountAmount || ""}
                  placeholder="0"
                  onChange={(e) => setDiscountAmount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold block mb-1.5">
                  Biaya Ongkir (Rp)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={shippingCost || ""}
                  placeholder="0 (Ambil di Toko)"
                  onChange={(e) => setShippingCost(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold block mb-1.5">
                  Catatan Transaksi
                </Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Ambil langsung / kirim via J&T"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Bagian 4: Ringkasan Finansial Realtime */}
            <div className="p-4 rounded-xl bg-primary/[0.04] border border-primary/20 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal Produk:</span>
                <span className="font-mono font-semibold text-foreground">{formatIDR(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-semibold">
                  <span>Diskon Khusus:</span>
                  <span className="font-mono">-{formatIDR(discountAmount)}</span>
                </div>
              )}
              {shippingCost > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Biaya Pengiriman:</span>
                  <span className="font-mono">{formatIDR(shippingCost)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-foreground pt-2 border-t border-primary/20">
                <span>TOTAL HARGA BAYAR:</span>
                <span className="font-mono text-base text-primary">{formatIDR(grandTotal)}</span>
              </div>

              <div className="pt-2 border-t border-dashed border-primary/20 flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Coins className="size-3 text-amber-500" />
                  Total HPP Modal: <strong className="font-mono">{formatIDR(totalCostPrice)}</strong>
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <TrendingUp className="size-3.5" />
                  Laba Bersih: {formatIDR(estimatedProfit)} ({marginPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Batal
            </Button>

            <Button
              type="button"
              disabled={createOrderMutation.isPending || items.length === 0}
              onClick={() => createOrderMutation.mutate()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 text-xs"
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan Transaksi...
                </>
              ) : (
                <>
                  <Receipt className="size-4" />
                  Simpan Transaksi & Cetak Struk
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pop-up Cetak Struk & Invoice Otomatis */}
      <OrderReceiptModal
        order={createdOrderForReceipt}
        isOpen={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setCreatedOrderForReceipt(null);
        }}
      />
    </>
  );
}
