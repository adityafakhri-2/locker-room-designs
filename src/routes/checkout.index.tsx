import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIDR } from "@/lib/format";
import { createMayarPayment } from "@/lib/api/payment.functions";
import {
  calculateShippingRates,
  getStoreOrigin,
  ShippingService,
} from "@/lib/api/shipping.functions";
import { useCart } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { IndonesiaRegionSelector } from "@/components/app/IndonesiaRegionSelector";
import { parseAlamat } from "@/lib/format";
import { Ticket } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/checkout/")({
  head: () => ({ meta: [{ title: "Checkout — AA Jersey" }] }),
  component: CheckoutPage,
});

interface Voucher {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_purchase: number | string | null;
  max_discount?: number | string | null;
  usage_limit?: number | null;
  usage_count: number;
  status: string;
  end_date?: string | null;
}

function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "",
    recipient_no_hp: "",
    recipient_alamat: "",
    recipient_kota: "",
    recipient_provinsi: "",
    recipient_kode_pos: "",
    note: "",
    courier: "JNE REG",
  });
  const [alamatDetail, setAlamatDetail] = useState("");
  const [kecamatan, setKecamatan] = useState("");
  const [kelurahan, setKelurahan] = useState("");
  const [rates, setRates] = useState<ShippingService[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [originLocation, setOriginLocation] = useState<{ city: string; province: string } | null>(
    null,
  );
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Load store origin location on mount
  useEffect(() => {
    async function loadOrigin() {
      try {
        const res = await getStoreOrigin();
        if (res.success) {
          setOriginLocation({ city: res.city, province: res.province });
        }
      } catch (err) {
        console.error("Failed to load store origin location:", err);
      }
    }
    loadOrigin();
  }, []);

  // Voucher states
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [showVoucherDrawer, setShowVoucherDrawer] = useState(false);

  // Fetch active vouchers
  const vouchersQuery = useQuery({
    queryKey: ["active-vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Filter out expired vouchers or those whose usage limit is reached
      return (data ?? []).filter((v) => {
        const isExpired = v.end_date ? new Date(v.end_date) < new Date() : false;
        const isLimitReached = v.usage_limit ? v.usage_count >= v.usage_limit : false;
        return !isExpired && !isLimitReached;
      });
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("nama_lengkap, no_hp, alamat, kota, provinsi, kode_pos")
          .eq("id", user!.id)
          .maybeSingle()
      ).data,
    refetchOnMount: "always",
    staleTime: 0,
  });

  function fillFromProfile() {
    if (!profileQuery.data) {
      toast.error("Data profil tidak ditemukan");
      return;
    }
    const p = profileQuery.data;
    const metadataName = user?.user_metadata?.nama_lengkap || user?.user_metadata?.full_name || "";
    const parsed = parseAlamat(p.alamat || "");
    setForm((f) => ({
      ...f,
      recipient_name: p.nama_lengkap || metadataName || f.recipient_name,
      recipient_no_hp: p.no_hp || "",
      recipient_alamat: p.alamat || "",
      recipient_kota: p.kota || "",
      recipient_provinsi: p.provinsi || "",
      recipient_kode_pos: p.kode_pos || "",
    }));
    setAlamatDetail(parsed.street);
    setKecamatan(parsed.kecamatan);
    setKelurahan(parsed.kelurahan);
    toast.success("Data alamat disalin dari profil Anda");
  }

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && profileQuery.data) {
      const p = profileQuery.data;
      const metadataName =
        user.user_metadata?.nama_lengkap || user.user_metadata?.full_name || "";
      const parsed = parseAlamat(p.alamat || "");
      setForm((f) => ({
        ...f,
        recipient_name: f.recipient_name || p.nama_lengkap || metadataName,
        recipient_no_hp: f.recipient_no_hp || p.no_hp || "",
        recipient_alamat: f.recipient_alamat || p.alamat || "",
        recipient_kota: f.recipient_kota || p.kota || "",
        recipient_provinsi: f.recipient_provinsi || p.provinsi || "",
        recipient_kode_pos: f.recipient_kode_pos || p.kode_pos || "",
      }));
      if (parsed.street && !alamatDetail) setAlamatDetail(parsed.street);
      if (parsed.kecamatan && !kecamatan) setKecamatan(parsed.kecamatan);
      if (parsed.kelurahan && !kelurahan) setKelurahan(parsed.kelurahan);
    }
  }, [profileQuery.data, user]);

  useEffect(() => {
    if (!cart.isLoading && cart.data && cart.data.length === 0) {
      toast.error("Keranjang belanja Anda kosong. Silakan tambahkan produk terlebih dahulu.");
      navigate({ to: "/cart" });
    }
  }, [cart.data, cart.isLoading, navigate]);

  // Perbarui tarif ongkir JNE ketika lokasi pengiriman (sampai tingkat kecamatan) atau isi keranjang berubah
  useEffect(() => {
    async function updateRates() {
      const currentCart = cart.data ?? [];
      const currentQty = currentCart.reduce((s, i) => s + i.quantity, 0);

      if (
        !form.recipient_provinsi ||
        !form.recipient_kota ||
        !kecamatan ||
        currentCart.length === 0
      ) {
        setRates([]);
        return;
      }
      setRatesLoading(true);
      try {
        const result = await calculateShippingRates({
          data: {
            destinationProvinsi: form.recipient_provinsi,
            destinationKota: form.recipient_kota,
            destinationKecamatan: kecamatan,
            totalQuantity: currentQty,
          },
        });

        if (result.success && result.rates) {
          setRates(result.rates);
          if (result.originCity && result.originProvince) {
            setOriginLocation({ city: result.originCity, province: result.originProvince });
          }

          const hasReg = result.rates.find((r) => r.service === "REG");
          const defaultService = hasReg ? "JNE REG" : result.rates[0]?.name || "JNE REG";

          setForm((f) => {
            if (!result.rates!.some((r) => r.name === f.courier)) {
              return { ...f, courier: defaultService };
            }
            return f;
          });
        }
      } catch (err) {
        console.error("[Checkout UI] Gagal memperbarui ongkos kirim:", err);
      } finally {
        setRatesLoading(false);
      }
    }
    updateRates();
  }, [form.recipient_provinsi, form.recipient_kota, kecamatan, cart.data]);

  if (authLoading || (user && profileQuery.isLoading) || cart.isLoading)
    return (
      <>
        <Navbar />
        <main className="pt-28 md:pt-36 pb-20 container-swiss animate-pulse">
          <div className="h-9 bg-muted w-48 rounded mb-10" />
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            {/* Form Skeleton */}
            <div className="lg:col-span-7 space-y-6">
              <div className="h-6 bg-muted w-36 rounded" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-10 bg-muted rounded w-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-10 bg-muted rounded w-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted w-24 rounded" />
                  <div className="h-20 bg-muted rounded w-full" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-10 bg-muted rounded w-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-10 bg-muted rounded w-full" />
                  </div>
                </div>
              </div>
            </div>
            {/* Summary Skeleton */}
            <div className="lg:col-span-5 space-y-6">
              <div className="h-6 bg-muted w-32 rounded" />
              <div className="border border-border p-6 space-y-4">
                <div className="flex gap-4">
                  <div className="size-16 bg-muted rounded animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted w-3/4 rounded" />
                    <div className="h-4 bg-muted w-1/4 rounded" />
                  </div>
                </div>
                <hr className="border-border" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-4 bg-muted w-12 rounded" />
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted w-16 rounded" />
                    <div className="h-4 bg-muted w-12 rounded" />
                  </div>
                  <hr className="border-border" />
                  <div className="flex justify-between">
                    <div className="h-5 bg-muted w-20 rounded" />
                    <div className="h-5 bg-muted w-16 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  if (!user) {
    return null;
  }

  const items = cart.data ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.products?.price ?? 0) * i.quantity, 0);
  const selectedRate = rates.find((r) => r.name === form.courier);
  const shipping = selectedRate ? selectedRate.cost : 0;

  // Dynamic discount calculation
  let discountAmount = 0;
  if (selectedVoucher) {
    if (selectedVoucher.discount_type === "percentage") {
      discountAmount = subtotal * (Number(selectedVoucher.discount_value) / 100);
      if (selectedVoucher.max_discount && discountAmount > Number(selectedVoucher.max_discount)) {
        discountAmount = Number(selectedVoucher.max_discount);
      }
    } else {
      discountAmount = Number(selectedVoucher.discount_value);
    }
    if (discountAmount > subtotal) {
      discountAmount = subtotal;
    }
  }

  const total = subtotal + shipping - discountAmount;

  function applyVoucherCode(codeStr: string) {
    const codeClean = codeStr.trim().toUpperCase();
    if (!codeClean) {
      toast.error("Silakan masukkan kode voucher");
      return;
    }

    const found = vouchersQuery.data?.find((v) => v.code === codeClean);
    if (!found) {
      toast.error("Voucher tidak valid, kadaluarsa, atau kuota habis.");
      return;
    }

    if (subtotal < Number(found.min_purchase)) {
      toast.error(
        `Minimum belanja untuk menggunakan voucher ini adalah ${formatIDR(found.min_purchase)}`,
      );
      return;
    }

    setSelectedVoucher(found);
    setVoucherCodeInput(found.code);
    toast.success(`Voucher ${found.code} berhasil diterapkan!`);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return toast.error("Keranjang kosong");
    setLoading(true);

    // Validasi kuota voucher terbaru dari database sebelum pesanan dibuat
    if (selectedVoucher) {
      try {
        const { data: vData, error: vErr } = await supabase
          .from("vouchers")
          .select("*")
          .eq("id", selectedVoucher.id)
          .single();

        if (vErr || !vData) {
          setLoading(false);
          return toast.error("Voucher tidak ditemukan.");
        }

        if (vData.status !== "active") {
          setLoading(false);
          return toast.error("Voucher sudah tidak aktif.");
        }

        if (vData.end_date && new Date(vData.end_date) < new Date()) {
          setLoading(false);
          return toast.error("Voucher sudah kadaluarsa.");
        }

        if (vData.usage_limit && vData.usage_count >= vData.usage_limit) {
          setLoading(false);
          return toast.error("Kuota penggunaan voucher sudah habis.");
        }
      } catch (err) {
        setLoading(false);
        return toast.error("Gagal memvalidasi kuota voucher.");
      }
    }

    const finalAlamat =
      alamatDetail +
      (kecamatan ? `, Kec. ${kecamatan}` : "") +
      (kelurahan ? `, Kel. ${kelurahan}` : "");

    let createdOrderId: string | null = null;

    try {
      // 1. Buat pesanan di Supabase
      const { data: order, error: oerr } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          status: "pending",
          subtotal,
          shipping_cost: shipping,
          grand_total: total,
          courier: form.courier,
          recipient_name: form.recipient_name,
          recipient_no_hp: form.recipient_no_hp,
          recipient_alamat: finalAlamat,
          recipient_kota: form.recipient_kota,
          recipient_provinsi: form.recipient_provinsi,
          recipient_kode_pos: form.recipient_kode_pos,
          note: form.note,
          voucher_id: selectedVoucher ? selectedVoucher.id : null,
          voucher_code: selectedVoucher ? selectedVoucher.code : null,
          discount_amount: discountAmount,
        })
        .select("*")
        .single();
      if (oerr) throw oerr;
      createdOrderId = order.id;

      // Update profil pembeli dengan alamat & no HP pengiriman jika profil sebelumnya belum lengkap
      if (user) {
        supabase
          .from("profiles")
          .update({
            nama_lengkap: form.recipient_name,
            no_hp: form.recipient_no_hp,
            alamat: finalAlamat,
            kota: form.recipient_kota,
            provinsi: form.recipient_provinsi,
            kode_pos: form.recipient_kode_pos,
          })
          .eq("id", user.id)
          .then(() => {});
      }

      // 2. Masukkan item pesanan (Ini memicu trigger public.decrease_stock_on_order_item)
      const orderItems = items.map((i) => {
        const prod = i.products as any;
        const sizeCost = (prod?.size_cost_price as Record<string, number> | null) ?? {};
        const unitCost =
          i.size && sizeCost[i.size] !== undefined && Number(sizeCost[i.size]) > 0
            ? Number(sizeCost[i.size])
            : Number(prod?.cost_price) || 0;

        return {
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.products?.name ?? "",
          product_slug: i.products?.slug ?? null,
          image_url: i.products?.cover_image_url ?? null,
          size: i.size,
          unit_price: i.products?.price ?? 0,
          cost_price: unitCost,
          quantity: i.quantity,
          subtotal: Number(i.products?.price ?? 0) * i.quantity,
        };
      });
      const { error: ierr } = await supabase.from("order_items").insert(orderItems);
      if (ierr) throw ierr;

      // 3. Buat Invoice Mayar.id melalui Server Function
      const redirectUrl = `${window.location.origin}/checkout/success/${order.order_number}`;
      const mayarResult = await createMayarPayment({
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          amount: total,
          customerName: form.recipient_name,
          customerEmail: user!.email || "",
          customerMobile: form.recipient_no_hp,
          redirectUrl: redirectUrl,
        },
      });

      if (!mayarResult || !mayarResult.link) {
        throw new Error("Gagal membuat tautan pembayaran Mayar.id");
      }

      // 4. Catat transaksi pembayaran dengan tautan Mayar di kolom 'bank' dan ID invoice di 'reject_reason'
      const { error: perr } = await supabase.from("payments").insert({
        order_id: order.id,
        amount: total,
        method: "mayar",
        bank: mayarResult.link, // Simpan link Mayar di kolom bank
        reject_reason: mayarResult.invoiceId, // Simpan ID invoice di reject_reason
        status: "waiting_payment",
      });
      if (perr) throw perr;

      // 5. Bersihkan keranjang belanja
      await supabase.from("cart_items").delete().eq("user_id", user!.id);

      toast.success("Pesanan dibuat. Mengalihkan ke pembayaran...");

      // Alihkan pengguna langsung ke halaman pembayaran Mayar.id
      window.location.href = mayarResult.link;
    } catch (e) {
      toast.error((e as Error).message);

      // ROLLBACK / COMPENSATING TRANSACTION JIKA INTEGRASI MAYAR GAGAL
      if (createdOrderId) {
        try {
          // 1. Batalkan pesanan agar stok dikembalikan oleh trigger database trg_restore_stock_on_order_cancel
          await supabase
            .from("orders")
            .update({
              status: "cancelled",
              cancel_reason: "Gagal membuat tagihan pembayaran Mayar.id",
            })
            .eq("id", createdOrderId);

          // 2. Kembalikan kuota penggunaan voucher ke semula
          if (selectedVoucher) {
            const { data: vData } = await supabase
              .from("vouchers")
              .select("usage_count")
              .eq("id", selectedVoucher.id)
              .single();

            if (vData) {
              const newCount = Math.max(vData.usage_count - 1, 0);
              await supabase
                .from("vouchers")
                .update({
                  usage_count: newCount,
                  status: "active", // Kembalikan status ke active jika sebelumnya sempat berubah inactive
                })
                .eq("id", selectedVoucher.id);
            }
          }
        } catch (cleanupErr) {
          console.error("[Checkout Cleanup] Gagal melakukan rollback pesanan:", cleanupErr);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main id="main-content" className="pt-24 md:pt-28 pb-20 container-swiss min-h-screen">
        <div className="mb-10 border-b border-border pb-6">
          <span className="eyebrow text-muted-foreground">Checkout</span>
          <h1 className="display-lg mt-2">Selesaikan Pesanan</h1>
        </div>

        <form
          onSubmit={submit}
          className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-10"
        >
          <div className="space-y-8 w-full max-w-full">
            <section className="w-full">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h2 className="display-md">Alamat Pengiriman</h2>
                {profileQuery.data && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fillFromProfile}
                    className="cursor-pointer text-xs h-8"
                  >
                    Gunakan Data Profil Saya
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <div className="sm:col-span-2">
                  <Label htmlFor="recipient_name">Nama Penerima</Label>
                  <Input
                    id="recipient_name"
                    required
                    value={form.recipient_name}
                    onChange={(e) => set("recipient_name", e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="recipient_no_hp">Nomor HP</Label>
                  <Input
                    id="recipient_no_hp"
                    required
                    value={form.recipient_no_hp}
                    onChange={(e) => set("recipient_no_hp", e.target.value)}
                  />
                </div>

                <IndonesiaRegionSelector
                  provinsi={form.recipient_provinsi}
                  setProvinsi={(val) => set("recipient_provinsi", val)}
                  kota={form.recipient_kota}
                  setKota={(val) => set("recipient_kota", val)}
                  kecamatan={kecamatan}
                  setKecamatan={setKecamatan}
                  kelurahan={kelurahan}
                  setKelurahan={setKelurahan}
                  kodePos={form.recipient_kode_pos}
                  setKodePos={(val) => set("recipient_kode_pos", val)}
                  alamatDetail={alamatDetail}
                  setAlamatDetail={setAlamatDetail}
                  required={true}
                />

                <div className="sm:col-span-2">
                  <Label htmlFor="note">Catatan Pesanan</Label>
                  <Textarea
                    id="note"
                    placeholder="Contoh: Titipkan ke satpam jika sedang keluar, patokan warna pagar/toko, atau instruksi pengiriman lainnya..."
                    value={form.note}
                    onChange={(e) => set("note", e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
                <h2 className="display-md font-extrabold">Kurir</h2>
                {originLocation && (
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full border border-border">
                    Dikirim dari:{" "}
                    <strong className="font-semibold text-foreground">
                      {originLocation.city}, {originLocation.province}
                    </strong>
                  </span>
                )}
              </div>
              {!form.recipient_provinsi || !form.recipient_kota || !kecamatan ? (
                <div className="border border-dashed border-border p-6 text-center text-sm text-muted-foreground rounded-lg bg-muted/20">
                  Silakan tentukan provinsi, kota, dan kecamatan alamat pengiriman Anda terlebih
                  dahulu untuk melihat pilihan layanan kurir JNE.
                </div>
              ) : ratesLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="border border-border p-4 rounded-lg animate-pulse bg-muted/40 h-20 flex flex-col justify-center"
                    >
                      <div className="h-4 bg-muted-foreground/20 rounded w-2/3 mb-2"></div>
                      <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : rates.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  {rates.map((r) => (
                    <button
                      type="button"
                      key={r.name}
                      onClick={() => set("courier", r.name)}
                      className={`border p-4 text-left cursor-pointer transition-all rounded-lg ${
                        form.courier === r.name
                          ? "border-primary bg-accent/40 shadow-sm"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{r.name}</span>
                        <img
                          src="https://upload.wikimedia.org/wikipedia/commons/9/92/New_Logo_JNE.png"
                          alt="JNE"
                          className="h-4 object-contain"
                        />
                      </div>
                      <div className="text-sm font-extrabold text-foreground mt-1.5">
                        {formatIDR(r.cost)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <span>Estimasi:</span>
                        <span className="font-medium text-foreground">{r.etd}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-destructive/20 p-6 text-center text-sm text-destructive rounded-lg bg-destructive/5">
                  Gagal memuat tarif pengiriman untuk wilayah ini. Silakan hubungi admin atau coba
                  lagi.
                </div>
              )}
            </section>

            <section className="bg-primary/5 border border-primary/20 p-6 rounded-lg w-full">
              <h2 className="display-md mb-4 flex items-center gap-2">Metode Pembayaran</h2>
              <div className="flex items-center gap-4">
                <div className="bg-white px-3 py-2 rounded shadow-sm border border-border flex-shrink-0 flex items-center justify-center">
                  <img
                    src="https://framerusercontent.com/assets/0aaSOxupKAsVA4ou30WbxLvSQo0.png"
                    alt="Mayar"
                    className="h-7 object-contain"
                  />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-foreground">
                    Pembayaran Instan & Otomatis via Mayar
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Mendukung QRIS, E-Wallet (GoPay, OVO, ShopeePay), Virtual Account (BCA, Mandiri,
                    BNI), dan Kartu Kredit.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside className="bg-muted/40 border border-border p-6 self-start lg:sticky lg:top-24">
            <h2 className="font-extrabold text-lg">Ringkasan Pesanan</h2>
            <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 text-sm">
                  <div className="size-14 bg-background overflow-hidden flex-shrink-0">
                    {i.products?.cover_image_url && (
                      <img
                        src={i.products.cover_image_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{i.products?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.size} × {i.quantity}
                    </p>
                  </div>
                  <span className="tabular-nums">
                    {formatIDR(Number(i.products?.price ?? 0) * i.quantity)}
                  </span>
                </div>
              ))}
            </div>
            {/* Voucher Section */}
            <div className="border-t border-border mt-4 pt-4">
              <Label
                htmlFor="voucher-code"
                className="font-bold text-xs uppercase text-muted-foreground flex items-center gap-1"
              >
                <Ticket className="size-3.5" /> Voucher Belanja
              </Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  id="voucher-code"
                  placeholder="Kode voucher"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                  className="h-10 text-sm bg-background"
                />
                {selectedVoucher ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedVoucher(null);
                      setVoucherCodeInput("");
                    }}
                    className="h-10 text-xs px-3 text-destructive border-destructive hover:bg-destructive/10 cursor-pointer flex-shrink-0"
                  >
                    Batal
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => applyVoucherCode(voucherCodeInput)}
                    className="h-10 text-xs px-4 cursor-pointer flex-shrink-0"
                  >
                    Pakai
                  </Button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowVoucherDrawer(true)}
                className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer w-full text-left"
              >
                Lihat daftar voucher tersedia
              </button>
            </div>

            <dl className="mt-6 text-sm space-y-2 border-t border-border pt-4">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatIDR(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Ongkos kirim</dt>
                <dd>{formatIDR(shipping)}</dd>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <dt className="flex items-center gap-1">
                    <Ticket className="size-3.5" />
                    Diskon ({selectedVoucher?.code})
                  </dt>
                  <dd>-{formatIDR(discountAmount)}</dd>
                </div>
              )}
            </dl>
            <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-extrabold">
              <span>Total</span>
              <span>{formatIDR(total)}</span>
            </div>
            <Button
              type="submit"
              className="w-full mt-6 h-12 cursor-pointer"
              disabled={loading || items.length === 0 || ratesLoading || !selectedRate}
            >
              {loading ? "Memproses..." : ratesLoading ? "Menghitung Ongkir..." : "Buat Pesanan"}
            </Button>
          </aside>
        </form>
      </main>

      {/* Dialog Voucher Selection */}
      <Dialog open={showVoucherDrawer} onOpenChange={setShowVoucherDrawer}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="size-5 text-primary" /> Voucher Tersedia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {vouchersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Memuat voucher...</p>
            ) : vouchersQuery.data && vouchersQuery.data.length > 0 ? (
              vouchersQuery.data.map((v) => {
                const isApplicable = subtotal >= Number(v.min_purchase);
                const isSelected = selectedVoucher?.id === v.id;

                return (
                  <div
                    key={v.id}
                    className={`relative border-2 border-dashed rounded-lg p-4 flex items-center justify-between transition-all overflow-hidden bg-background
                      ${isSelected ? "border-primary bg-primary/5" : "border-border"}
                      ${!isApplicable ? "opacity-60" : "hover:border-primary/50"}
                      before:absolute before:left-[-10px] before:top-[calc(50%-10px)] before:w-5 before:h-5 before:bg-muted before:rounded-full before:border-r before:border-dashed before:border-border
                      after:absolute after:right-[-10px] after:top-[calc(50%-10px)] after:w-5 after:h-5 after:bg-muted after:rounded-full after:border-l after:border-dashed after:border-border`}
                  >
                    <div className="flex-1 pr-4 pl-2 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm bg-accent px-2 py-0.5 rounded border border-border">
                          {v.code}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] bg-primary text-primary-foreground font-bold px-1.5 py-0.5 rounded">
                            Terpasang
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-base">
                        {v.discount_type === "percentage"
                          ? `Diskon ${v.discount_value}%`
                          : `Diskon ${formatIDR(v.discount_value)}`}
                      </div>
                      {v.discount_type === "percentage" && v.max_discount && (
                        <div className="text-xs text-muted-foreground">
                          Maksimal potongan: {formatIDR(v.max_discount)}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1.5 space-y-0.5">
                        <p>
                          Min. Belanja:{" "}
                          <span className="font-medium">{formatIDR(v.min_purchase)}</span>
                        </p>
                        {v.end_date && (
                          <p>
                            Berlaku s/d:{" "}
                            {new Date(v.end_date).toLocaleDateString("id-ID", {
                              dateStyle: "medium",
                            })}
                          </p>
                        )}
                      </div>
                      {!isApplicable && (
                        <p className="text-[10px] text-destructive font-bold mt-2">
                          * Belum memenuhi minimum belanja {formatIDR(v.min_purchase)}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 z-10">
                      {isSelected ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedVoucher(null);
                            setVoucherCodeInput("");
                            setShowVoucherDrawer(false);
                          }}
                          className="cursor-pointer text-xs"
                        >
                          Batal
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!isApplicable}
                          onClick={() => {
                            setSelectedVoucher(v);
                            setVoucherCodeInput(v.code);
                            setShowVoucherDrawer(false);
                            toast.success(`Voucher ${v.code} diterapkan!`);
                          }}
                          className="cursor-pointer text-xs"
                        >
                          Gunakan
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada voucher tersedia saat ini.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Footer />
    </>
  );
}
