import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { useCart, useRemoveFromCart, useUpdateCart } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
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

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Keranjang — AA Jersey" }] }),
  component: CartPage,
});

function CartPage() {
  const { user, loading } = useAuth();
  const cart = useCart();
  const update = useUpdateCart();
  const remove = useRemoveFromCart();
  const navigate = useNavigate();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  function handleDeleteClick(id: string) {
    setDeleteItemId(id);
    setDeleteConfirmOpen(true);
  }

  if (loading)
    return (
      <>
        <Navbar />
        <main className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen animate-pulse">
          <div className="h-9 bg-muted w-48 rounded mb-10" />
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
            {/* Items List Skeleton */}
            <div className="lg:col-span-8 space-y-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <div className="size-20 md:size-24 bg-muted rounded shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 bg-muted w-2/3 rounded animate-pulse" />
                    <div className="h-4 bg-muted w-1/3 rounded animate-pulse" />
                  </div>
                  <div className="h-8 bg-muted w-16 rounded animate-pulse" />
                </div>
              ))}
            </div>

            {/* Summary Box Skeleton */}
            <div className="lg:col-span-4 space-y-6">
              <div className="border border-border p-6 space-y-4">
                <div className="h-5 bg-muted w-24 rounded animate-pulse" />
                <hr className="border-border" />
                <div className="flex justify-between">
                  <div className="h-4 bg-muted w-16 rounded animate-pulse" />
                  <div className="h-4 bg-muted w-16 rounded animate-pulse" />
                </div>
                <hr className="border-border" />
                <div className="h-12 bg-muted rounded w-full animate-pulse" />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  if (!user) {
    return (
      <>
        <Navbar />
        <div className="pt-32 pb-20 container-swiss min-h-screen">
          <h1 className="display-md">Keranjang</h1>
          <p className="mt-4 text-muted-foreground">Silakan login untuk melihat keranjang.</p>
          <Button asChild className="mt-6">
            <Link to="/auth">Masuk</Link>
          </Button>
        </div>
      </>
    );
  }

  const items = cart.data ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.products?.price ?? 0) * i.quantity, 0);

  return (
    <>
      <Navbar />
      <main id="main-content" className="pt-24 md:pt-28 pb-20 container-swiss min-h-screen">
        <div className="mb-10 border-b border-border pb-6">
          <span className="eyebrow text-muted-foreground">Cart</span>
          <h1 className="display-lg mt-2">Keranjang Belanja</h1>
        </div>

        {items.length === 0 ? (
          <div className="border border-dashed border-border p-16 text-center">
            <h3 className="display-md">Keranjang kosong</h3>
            <p className="mt-3 text-muted-foreground">Belum ada produk di keranjang.</p>
            <Button asChild className="mt-6">
              <Link to="/shop">Mulai Belanja</Link>
            </Button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
            <div className="border-t border-border">
              {items.map((i) => (
                <div
                  key={i.id}
                  className="grid grid-cols-[80px_minmax(0,1fr)] sm:grid-cols-[100px_minmax(0,1fr)_auto] gap-4 sm:gap-5 py-6 border-b border-border relative"
                >
                  <div className="aspect-square bg-muted overflow-hidden">
                    {i.products?.cover_image_url && (
                      <img
                        src={i.products.cover_image_url}
                        alt=""
                        className="size-full object-cover"
                      />
                    )}
                  </div>
                  <div className="pr-8 sm:pr-0">
                    <Link
                      to="/product/$slug"
                      params={{ slug: i.products?.slug ?? "" }}
                      className="font-semibold hover:underline text-sm sm:text-base block truncate sm:whitespace-normal"
                    >
                      {i.products?.name}
                    </Link>
                    {i.size && (
                      <p className="text-xs text-muted-foreground mt-1">Ukuran: {i.size}</p>
                    )}
                    <p className="text-sm font-semibold mt-2">
                      {formatIDR(i.products?.price ?? 0)}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => update.mutate({ id: i.id, quantity: i.quantity - 1 })}
                        disabled={i.quantity <= 1 || update.isPending}
                        className="size-11 border border-border grid place-items-center cursor-pointer hover:border-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                        aria-label={`Kurangi kuantitas ${i.products?.name}`}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium tabular-nums">
                        {i.quantity}
                      </span>
                      <button
                        onClick={() => update.mutate({ id: i.id, quantity: i.quantity + 1 })}
                        disabled={update.isPending}
                        className="size-11 border border-border grid place-items-center cursor-pointer hover:border-foreground disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                        aria-label={`Tambah kuantitas ${i.products?.name}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteClick(i.id)}
                    className="absolute top-6 right-0 sm:static text-muted-foreground hover:text-destructive self-start cursor-pointer transition-colors p-1 focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 outline-none rounded-md"
                    aria-label={`Hapus ${i.products?.name} dari keranjang`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>

            <aside className="bg-muted/40 border border-border p-6 self-start">
              <h2 className="font-extrabold text-lg">Ringkasan</h2>
              <dl className="mt-4 text-sm space-y-2">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold">{formatIDR(subtotal)}</dd>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <dt>Ongkos kirim</dt>
                  <dd>Dihitung saat checkout</dd>
                </div>
              </dl>
              <div className="border-t border-border mt-4 pt-4 flex justify-between text-base font-extrabold">
                <span>Total</span>
                <span>{formatIDR(subtotal)}</span>
              </div>
              <Button
                className="w-full mt-6 h-12 cursor-pointer"
                onClick={() => navigate({ to: "/checkout" })}
              >
                Lanjut ke Checkout
              </Button>
            </aside>
          </div>
        )}
      </main>
      <Footer />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Barang dari Keranjang</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus barang ini dari keranjang belanja Anda?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
              onClick={() => {
                if (deleteItemId) {
                  remove.mutate(deleteItemId);
                }
                setDeleteConfirmOpen(false);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
