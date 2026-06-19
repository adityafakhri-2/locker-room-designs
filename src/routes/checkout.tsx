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
import { formatIDR, SHIPPING_RATES, BANKS } from "@/lib/format";
import { useCart } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — The Locker Room" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    recipient_name: "", recipient_no_hp: "", recipient_alamat: "", recipient_kota: "",
    recipient_provinsi: "", recipient_kode_pos: "", note: "", courier: "JNE", bank: "BCA",
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
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
    setForm((f) => ({
      ...f,
      recipient_name: p.nama_lengkap || metadataName || f.recipient_name,
      recipient_no_hp: p.no_hp || "",
      recipient_alamat: p.alamat || "",
      recipient_kota: p.kota || "",
      recipient_provinsi: p.provinsi || "",
      recipient_kode_pos: p.kode_pos || "",
    }));
    toast.success("Data alamat disalin dari profil Anda");
  }

  useEffect(() => {
    if (user && profileQuery.data) {
      const p = profileQuery.data;
      const metadataName = user.user_metadata?.nama_lengkap || user.user_metadata?.full_name || "";
      setForm((f) => ({
        ...f,
        recipient_name: f.recipient_name || p.nama_lengkap || metadataName,
        recipient_no_hp: f.recipient_no_hp || p.no_hp || "",
        recipient_alamat: f.recipient_alamat || p.alamat || "",
        recipient_kota: f.recipient_kota || p.kota || "",
        recipient_provinsi: f.recipient_provinsi || p.provinsi || "",
        recipient_kode_pos: f.recipient_kode_pos || p.kode_pos || "",
      }));
    }
  }, [profileQuery.data, user]);

  if (authLoading) return (<><Navbar /><div className="pt-32 container-swiss">Memuat...</div></>);
  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  const items = cart.data ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.products?.price ?? 0) * i.quantity, 0);
  const shipping = SHIPPING_RATES[form.courier] ?? 0;
  const total = subtotal + shipping;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return toast.error("Keranjang kosong");
    setLoading(true);
    try {
      const { data: order, error: oerr } = await supabase
        .from("orders")
        .insert({
          user_id: user!.id,
          status: "pending",
          subtotal, shipping_cost: shipping, grand_total: total,
          courier: form.courier,
          recipient_name: form.recipient_name,
          recipient_no_hp: form.recipient_no_hp,
          recipient_alamat: form.recipient_alamat,
          recipient_kota: form.recipient_kota,
          recipient_provinsi: form.recipient_provinsi,
          recipient_kode_pos: form.recipient_kode_pos,
          note: form.note,
        })
        .select("*")
        .single();
      if (oerr) throw oerr;

      const orderItems = items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: i.products?.name ?? "",
        product_slug: i.products?.slug ?? null,
        image_url: i.products?.cover_image_url ?? null,
        size: i.size,
        unit_price: i.products?.price ?? 0,
        quantity: i.quantity,
        subtotal: Number(i.products?.price ?? 0) * i.quantity,
      }));
      const { error: ierr } = await supabase.from("order_items").insert(orderItems);
      if (ierr) throw ierr;

      const { error: perr } = await supabase.from("payments").insert({
        order_id: order.id, amount: total, bank: form.bank, status: "waiting_payment",
      });
      if (perr) throw perr;

      // Clear cart
      await supabase.from("cart_items").delete().eq("user_id", user!.id);

      toast.success("Pesanan dibuat");
      navigate({ to: "/checkout/success/$orderNumber", params: { orderNumber: order.order_number } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="pt-24 md:pt-28 pb-20 container-swiss min-h-screen">
        <div className="mb-10 border-b border-border pb-6">
          <span className="eyebrow text-muted-foreground">Checkout</span>
          <h1 className="display-lg mt-2">Selesaikan Pesanan</h1>
        </div>

        <form onSubmit={submit} className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-10">
          <div className="space-y-8">
            <section>
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
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label>Nama Penerima</Label><Input required value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} /></div>
                <div><Label>Nomor HP</Label><Input required value={form.recipient_no_hp} onChange={(e) => set("recipient_no_hp", e.target.value)} /></div>
                <div><Label>Kode Pos</Label><Input required value={form.recipient_kode_pos} onChange={(e) => set("recipient_kode_pos", e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Alamat Lengkap</Label><Textarea required value={form.recipient_alamat} onChange={(e) => set("recipient_alamat", e.target.value)} /></div>
                <div><Label>Kota</Label><Input required value={form.recipient_kota} onChange={(e) => set("recipient_kota", e.target.value)} /></div>
                <div><Label>Provinsi</Label><Input required value={form.recipient_provinsi} onChange={(e) => set("recipient_provinsi", e.target.value)} /></div>
                <div className="sm:col-span-2"><Label>Catatan Pesanan</Label><Textarea value={form.note} onChange={(e) => set("note", e.target.value)} /></div>
              </div>
            </section>

            <section>
              <h2 className="display-md mb-6">Kurir</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(SHIPPING_RATES).map(([k, v]) => (
                  <button type="button" key={k} onClick={() => set("courier", k)}
                    className={`border p-4 text-left cursor-pointer transition-all ${form.courier === k ? "border-primary bg-accent" : "border-border"}`}>
                    <div className="font-semibold">{k}</div>
                    <div className="text-xs text-muted-foreground mt-1">{formatIDR(v)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="display-md mb-6">Metode Pembayaran</h2>
              <p className="text-sm text-muted-foreground mb-4">Transfer Bank Manual. Pilih bank tujuan transfer:</p>
              <div className="grid grid-cols-3 gap-3">
                {BANKS.map((b) => (
                  <button type="button" key={b.code} onClick={() => set("bank", b.code)}
                    className={`border p-4 text-center cursor-pointer transition-all ${form.bank === b.code ? "border-primary bg-accent" : "border-border"}`}>
                    <div className="font-semibold">{b.name}</div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="bg-muted/40 border border-border p-6 self-start lg:sticky lg:top-24">
            <h2 className="font-extrabold text-lg">Ringkasan Pesanan</h2>
            <div className="mt-4 space-y-3 max-h-64 overflow-y-auto">
              {items.map((i) => (
                <div key={i.id} className="flex gap-3 text-sm">
                  <div className="size-14 bg-background overflow-hidden flex-shrink-0">
                    {i.products?.cover_image_url && <img src={i.products.cover_image_url} alt="" className="size-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{i.products?.name}</p>
                    <p className="text-xs text-muted-foreground">{i.size} × {i.quantity}</p>
                  </div>
                  <span className="tabular-nums">{formatIDR(Number(i.products?.price ?? 0) * i.quantity)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-6 text-sm space-y-2 border-t border-border pt-4">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatIDR(subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Ongkos kirim</dt><dd>{formatIDR(shipping)}</dd></div>
            </dl>
            <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-extrabold">
              <span>Total</span><span>{formatIDR(total)}</span>
            </div>
            <Button type="submit" className="w-full mt-6 h-12 cursor-pointer" disabled={loading || items.length === 0}>
              {loading ? "Memproses..." : "Buat Pesanan"}
            </Button>
          </aside>
        </form>
      </div>
      <Footer />
    </>
  );
}
