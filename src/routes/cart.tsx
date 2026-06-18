import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, Plus, Minus } from "lucide-react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { useCart, useRemoveFromCart, useUpdateCart } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Keranjang — The Locker Room" }] }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const update = useUpdateCart();
  const remove = useRemoveFromCart();
  const navigate = useNavigate();

  if (loading) return (<><Navbar /><div className="pt-32 container-swiss min-h-screen">Memuat...</div></>);
  if (!user) {
    return (
      <>
        <Navbar />
        <div className="pt-32 pb-20 container-swiss min-h-screen">
          <h1 className="display-md">Keranjang</h1>
          <p className="mt-4 text-muted-foreground">Silakan login untuk melihat keranjang.</p>
          <Button asChild className="mt-6"><Link to="/auth">Masuk</Link></Button>
        </div>
      </>
    );
  }

  const items = cart.data ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.products?.price ?? 0) * i.quantity, 0);

  return (
    <>
      <Navbar />
      <div className="pt-24 md:pt-28 pb-20 container-swiss min-h-screen">
        <div className="mb-10 border-b border-border pb-6">
          <span className="eyebrow text-muted-foreground">Cart</span>
          <h1 className="display-lg mt-2">Keranjang Belanja</h1>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-border p-16 text-center">
            <h3 className="display-md">Keranjang kosong</h3>
            <p className="mt-3 text-muted-foreground">Belum ada produk di keranjang.</p>
            <Button asChild className="mt-6"><Link to="/shop">Mulai Belanja</Link></Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
            <div className="border-t border-border">
              {items.map((i) => (
                <div key={i.id} className="grid grid-cols-[100px_minmax(0,1fr)_auto] gap-5 py-6 border-b border-border">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {i.products?.cover_image_url && <img src={i.products.cover_image_url} alt="" className="size-full object-cover" />}
                  </div>
                  <div>
                    <Link to="/product/$slug" params={{ slug: i.products?.slug ?? "" }} className="font-semibold hover:underline">{i.products?.name}</Link>
                    {i.size && <p className="text-xs text-muted-foreground mt-1">Ukuran: {i.size}</p>}
                    <p className="text-sm font-semibold mt-2">{formatIDR(i.products?.price ?? 0)}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => update.mutate({ id: i.id, quantity: i.quantity - 1 })} className="size-7 border border-border grid place-items-center"><Minus className="size-3" /></button>
                      <span className="w-8 text-center text-sm tabular-nums">{i.quantity}</span>
                      <button onClick={() => update.mutate({ id: i.id, quantity: i.quantity + 1 })} className="size-7 border border-border grid place-items-center"><Plus className="size-3" /></button>
                    </div>
                  </div>
                  <button onClick={() => remove.mutate(i.id)} className="text-muted-foreground hover:text-destructive self-start"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </div>

            <aside className="bg-muted/40 border border-border p-6 self-start">
              <h2 className="font-extrabold text-lg">Ringkasan</h2>
              <dl className="mt-4 text-sm space-y-2">
                <div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold">{formatIDR(subtotal)}</dd></div>
                <div className="flex justify-between text-muted-foreground"><dt>Ongkos kirim</dt><dd>Dihitung saat checkout</dd></div>
              </dl>
              <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-extrabold">
                <span>Total</span><span>{formatIDR(subtotal)}</span>
              </div>
              <Button className="w-full mt-6 h-12" onClick={() => navigate({ to: "/checkout" })}>Lanjut ke Checkout</Button>
            </aside>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
