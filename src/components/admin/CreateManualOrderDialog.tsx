import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatIDR, formatDate } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Plus,
  Trash2,
  Receipt,
  Coins,
  TrendingUp,
  CreditCard,
  Banknote,
  Building2,
  QrCode,
  Calendar as CalendarIcon,
  User,
  Phone,
  Shirt,
  Search,
  Check,
  ChevronsUpDown,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  sizeCostPriceMap: Record<string, number>;
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
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank_transfer" | "qris">("cash");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
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
      sizeCostPriceMap: {},
      totalStock: 0,
    },
  ]);

  // Product Popover State per row
  const [openProductPopoverIndex, setOpenProductPopoverIndex] = useState<number | null>(null);
  const [productSearchTerm, setProductSearchTerm] = useState("");

  // Created Receipt Modal State
  const [createdOrderForReceipt, setCreatedOrderForReceipt] = useState<OrderReceiptData | null>(
    null,
  );
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Fetch Existing Customers (from Profiles & Previous Orders)
  const customersQuery = useQuery({
    queryKey: ["customers-for-manual-order"],
    enabled: isOpen,
    queryFn: async () => {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("id, nama_lengkap, email, no_hp, kota, alamat"),
        supabase
          .from("orders")
          .select("user_id, recipient_name, recipient_no_hp, recipient_kota, recipient_alamat")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const map = new Map<
        string,
        {
          id?: string;
          name: string;
          phone: string;
          email?: string;
          city?: string;
          address?: string;
          type: "online" | "offline";
        }
      >();

      (profilesRes.data ?? []).forEach((p) => {
        if (p.nama_lengkap) {
          const key = p.nama_lengkap.trim().toLowerCase();
          map.set(key, {
            id: p.id,
            name: p.nama_lengkap.trim(),
            phone: p.no_hp || "",
            email: p.email || "",
            city: p.kota || "",
            address: p.alamat || "",
            type: "online",
          });
        }
      });

      (ordersRes.data ?? []).forEach((o) => {
        if (o.recipient_name) {
          const key = o.recipient_name.trim().toLowerCase();
          if (!map.has(key)) {
            map.set(key, {
              id: o.user_id || undefined,
              name: o.recipient_name.trim(),
              phone: o.recipient_no_hp && o.recipient_no_hp !== "-" ? o.recipient_no_hp : "",
              city: o.recipient_kota || "",
              address: o.recipient_alamat || "",
              type: "offline",
            });
          }
        }
      });

      return Array.from(map.values());
    },
  });

  const allCustomers = customersQuery.data ?? [];

  // Filter matching customers based on typed recipientName
  const matchingCustomers = useMemo(() => {
    if (!recipientName.trim() || recipientName === "Pelanggan Toko (Walk-in)") return [];
    const term = recipientName.trim().toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.phone && c.phone.includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)),
    );
  }, [allCustomers, recipientName]);

  // Handle selecting an existing customer
  const handleSelectCustomer = (c: (typeof allCustomers)[0]) => {
    setRecipientName(c.name);
    if (c.phone) setPhone(c.phone);
    if (c.id) setSelectedCustomerId(c.id);
    setCustomerSearchOpen(false);
    toast.info(`Data pelanggan "${c.name}" diterapkan.`);
  };

  // Fetch Available Products
  const productsQuery = useQuery({
    queryKey: ["products-for-manual-order"],
    enabled: isOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id, slug, name, price, cost_price, cover_image_url, team, league, sizes, size_stock, stock, is_active",
        )
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as any[];
    },
  });

  const allProducts = (productsQuery.data ?? []) as any[];

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!productSearchTerm.trim()) return allProducts;
    const term = productSearchTerm.toLowerCase().trim();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.team && p.team.toLowerCase().includes(term)) ||
        (p.league && p.league.toLowerCase().includes(term)),
    );
  }, [allProducts, productSearchTerm]);

  // Update item row when selecting product
  const handleSelectProduct = (index: number, productId: string) => {
    const p = allProducts.find((item) => item.id === productId);
    if (!p) return;

    const sizes = p.sizes ?? [];
    const sizeStockRaw = (p.size_stock as Record<string, any> | null) ?? {};
    const sizeCost = sizeStockRaw["_cost_prices"] || (p as any).size_cost_price || {};
    // Default pick first available size or first size
    const firstAvailableSize =
      sizes.find((s: string) => (sizeStockRaw[s] ?? p.stock) > 0) || sizes[0] || "All Size";

    const selectedCost =
      sizeCost[firstAvailableSize] !== undefined
        ? Number(sizeCost[firstAvailableSize])
        : Number((p as any).cost_price) || 0;

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
        costPrice: selectedCost,
        availableSizes: sizes,
        sizeStockMap: sizeStockRaw,
        sizeCostPriceMap: sizeCost,
        totalStock: p.stock ?? 0,
      };
      return updated;
    });

    setOpenProductPopoverIndex(null);
    setProductSearchTerm("");
  };

  const handleUpdateItem = <K extends keyof OrderItemRow>(
    index: number,
    field: K,
    val: OrderItemRow[K],
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };

      // If size is changed, dynamically update the cost price for that specific size
      if (field === "size") {
        const sizeCostMap = updated[index].sizeCostPriceMap || {};
        if (sizeCostMap[val as string] !== undefined && sizeCostMap[val as string] > 0) {
          updated[index].costPrice = Number(sizeCostMap[val as string]);
        }
      }

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
        sizeCostPriceMap: {},
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
      if (!recipientName.trim()) {
        throw new Error("Nama pembeli / pelanggan wajib diisi!");
      }
      const validItems = items.filter((it) => it.productId && it.quantity > 0);
      if (validItems.length === 0) {
        throw new Error("Pilih minimal 1 jersey yang dibeli!");
      }

      // Generate Order Number: POS-YYYYMMDD-XXXX
      const dateObj = selectedDate || new Date();
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
        user_id: selectedCustomerId || user?.id || "00000000-0000-0000-0000-000000000000",
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
        created_at: dateObj.toISOString(),
        updated_at: dateObj.toISOString(),
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
        method: paymentMethod,
        bank: paymentBankLabel,
        verified_at: dateObj.toISOString(),
        created_at: dateObj.toISOString(),
        updated_at: dateObj.toISOString(),
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
        <DialogContent className="w-[calc(100%-1rem)] sm:w-full max-w-3xl max-h-[92dvh] flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-xl">
          <div className="p-3.5 sm:p-5 border-b border-border bg-card">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Receipt className="size-4 sm:size-5 text-primary shrink-0" />
              <span>Catat Transaksi Manual / POS (Offline)</span>
            </DialogTitle>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
              Catat pesanan offline dari outlet Cimahi, WhatsApp, atau event. Otomatis masuk laporan keuangan & memotong stok inventaris.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
            {/* Bagian 1: Data Pembeli & Info Transaksi */}
            <div className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/20 border border-border">
              <div className="relative">
                <Label className="text-xs font-semibold flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <User className="size-3.5 text-primary" />
                    Nama Pembeli / Pelanggan *
                  </span>
                  {selectedCustomerId && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <Check className="size-2.5" />
                      <span>Database</span>
                    </span>
                  )}
                </Label>

                <div className="relative">
                  <Input
                    value={recipientName}
                    onChange={(e) => {
                      setRecipientName(e.target.value);
                      setSelectedCustomerId(null);
                      setCustomerSearchOpen(true);
                    }}
                    onFocus={() => {
                      if (recipientName.trim() && matchingCustomers.length > 0) {
                        setCustomerSearchOpen(true);
                      }
                    }}
                    placeholder="Ketik nama pelanggan..."
                    className="h-9 text-xs pr-8 bg-background"
                  />
                  {recipientName && (
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientName("");
                        setSelectedCustomerId(null);
                        setPhone("");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Dropdown Suggestions if Matches Exist */}
                {customerSearchOpen && matchingCustomers.length > 0 && (
                  <div
                    className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden divide-y divide-border/20 max-h-52 overflow-y-auto animate-in fade-in-0 zoom-in-95 overscroll-contain"
                    data-radix-scroll-lock-ignore="true"
                    onWheelCapture={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <div className="p-2 text-[10px] font-bold text-muted-foreground bg-muted/40 uppercase tracking-wider flex items-center justify-between">
                      <span>Pilih Dari Database ({matchingCustomers.length})</span>
                      <span className="text-[9px] lowercase font-normal">klik untuk terapkan</span>
                    </div>
                    {matchingCustomers.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left p-2.5 hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {c.type === "online" ? (
                              <span className="text-[9px] bg-blue-500/10 text-blue-600 px-1 py-0.5 rounded border border-blue-500/20 font-semibold">
                                Akun Web
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1 py-0.5 rounded border border-emerald-500/20 font-semibold">
                                Toko / Kasir
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {c.phone ? `WA: ${c.phone}` : c.email || c.city || "Pelanggan Terdaftar"}
                          </div>
                        </div>
                        <div className="text-[10px] font-semibold text-primary shrink-0">
                          Pilih ↵
                        </div>
                      </button>
                    ))}
                    <div
                      className="p-2 bg-muted/20 text-[11px] text-muted-foreground hover:bg-muted cursor-pointer text-center"
                      onClick={() => setCustomerSearchOpen(false)}
                    >
                      + Gunakan nama <strong>"{recipientName}"</strong> sebagai pelanggan baru
                    </div>
                  </div>
                )}
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

              {/* Tanggal Transaksi (Custom Popover Calendar Matching Theme) */}
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5">
                  <CalendarIcon className="size-3.5 text-primary" />
                  Tanggal Transaksi *
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-between text-left font-normal text-xs bg-background border-input cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="size-3.5 text-primary" />
                        {selectedDate
                          ? selectedDate.toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Pilih Tanggal"}
                      </span>
                      <ChevronsUpDown className="size-3 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 z-[100] bg-popover border border-border shadow-xl rounded-xl"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                      className="rounded-lg border-0"
                    />
                  </PopoverContent>
                </Popover>
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
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Pilih Metode Pembayaran" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Tunai / Cash (Kasir)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="bank_transfer">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                        <span>Transfer Bank (BCA/Mandiri/BRI)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="qris">
                      <div className="flex items-center gap-2">
                        <QrCode className="size-4 text-purple-600 dark:text-purple-400" />
                        <span>QRIS / E-Wallet</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Bagian 2: Daftar Jersey yang Dibeli (Searchable Combobox) */}
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
                  className="h-8 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
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
                      <span className="text-xs font-bold text-muted-foreground pt-2">
                        #{idx + 1}
                      </span>

                      {/* Searchable Jersey Combobox */}
                      <div className="flex-1 min-w-[200px]">
                        <Popover
                          open={openProductPopoverIndex === idx}
                          onOpenChange={(open) => {
                            setOpenProductPopoverIndex(open ? idx : null);
                            if (open) setProductSearchTerm("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between h-10 text-xs font-normal bg-background border-input cursor-pointer",
                                !item.productId && "text-muted-foreground",
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {item.coverImage && (
                                  <img
                                    src={item.coverImage}
                                    alt=""
                                    className="size-6 rounded object-cover border border-border"
                                  />
                                )}
                                <span className="truncate font-semibold text-foreground">
                                  {item.productName
                                    ? `${item.productName} — ${formatIDR(item.unitPrice)} (Stok: ${item.totalStock} pcs)`
                                    : "Pilih Jersey dari Katalog..."}
                                </span>
                              </div>
                              <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[340px] sm:w-[460px] p-0 z-[100] bg-popover border border-border shadow-2xl rounded-xl overscroll-contain"
                            align="start"
                            data-radix-scroll-lock-ignore="true"
                            onWheelCapture={(e) => e.stopPropagation()}
                            onWheel={(e) => e.stopPropagation()}
                          >
                            <div className="p-3 border-b border-border bg-muted/30">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                  autoFocus
                                  placeholder="Ketik nama klub, tim, tahun, atau jersey..."
                                  value={productSearchTerm}
                                  onChange={(e) => setProductSearchTerm(e.target.value)}
                                  className="h-8 pl-8 pr-8 text-xs bg-background"
                                />
                                {productSearchTerm && (
                                  <button
                                    onClick={() => setProductSearchTerm("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    <X className="size-3" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div
                              className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-border/20 overscroll-contain"
                              data-radix-scroll-lock-ignore="true"
                              onWheelCapture={(e) => e.stopPropagation()}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {filteredProducts.length === 0 ? (
                                <div className="p-4 text-center text-xs text-muted-foreground">
                                  Tidak ada jersey yang cocok dengan pencarian "{productSearchTerm}"
                                </div>
                              ) : (
                                filteredProducts.map((p) => {
                                  const isSelected = item.productId === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleSelectProduct(idx, p.id)}
                                      className={cn(
                                        "w-full text-left p-2 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer",
                                        isSelected
                                          ? "bg-primary/10 text-primary font-bold"
                                          : "hover:bg-muted/80 text-foreground",
                                      )}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {p.cover_image_url ? (
                                          <img
                                            src={p.cover_image_url}
                                            alt=""
                                            className="size-8 rounded object-cover border border-border shrink-0"
                                          />
                                        ) : (
                                          <div className="size-8 rounded bg-muted grid place-items-center shrink-0">
                                            <Shirt className="size-4 text-muted-foreground" />
                                          </div>
                                        )}
                                        <div className="truncate">
                                          <div className="font-semibold truncate">{p.name}</div>
                                          <div className="text-[10px] text-muted-foreground">
                                            {p.team || p.league ? `${p.team || ""} · ${p.league || ""}` : "Jersey Bola"}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <div className="font-mono font-bold text-foreground">
                                          {formatIDR(p.price)}
                                        </div>
                                        <div
                                          className={cn(
                                            "text-[10px] font-semibold",
                                            p.stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500",
                                          )}
                                        >
                                          {p.stock > 0 ? `Stok: ${p.stock} pcs` : "Stok Habis"}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Tombol Hapus Baris */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className="h-10 w-10 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
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
                            Harga Satuan (Asli)
                          </Label>
                          <Input
                            type="text"
                            disabled
                            value={formatIDR(item.unitPrice)}
                            className="h-8 text-xs font-mono font-bold bg-muted/60 text-muted-foreground cursor-not-allowed opacity-90"
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

              <div className="pt-2 border-t border-dashed border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 text-xs">
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
          <div className="p-3.5 sm:p-4 border-t border-border bg-card flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs cursor-pointer h-9 w-full sm:w-auto">
              Batal
            </Button>

            <Button
              type="button"
              disabled={createOrderMutation.isPending || items.length === 0}
              onClick={() => createOrderMutation.mutate()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 text-xs cursor-pointer h-9 w-full sm:w-auto shadow-sm"
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
