import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Heart, Trash2 } from "lucide-react";
import { DashboardShell, PageHeader, Card } from "@/components/app/DashboardShell";
import { CUSTOMER_NAV } from "@/lib/navigation";
import { useWishlist, useToggleWishlist, useAddToCart } from "@/hooks/use-commerce";
import { Button } from "@/components/ui/button";
import { formatIDR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const navigate = useNavigate();
  const wl = useWishlist();
  const toggle = useToggleWishlist();
  const addToCart = useAddToCart();
  const items = wl.data ?? [];

  return (
    <DashboardShell items={CUSTOMER_NAV} title="Akun Saya">
      <PageHeader eyebrow="Wishlist" title="Jersey Favorit" />
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            Wishlist masih kosong.{" "}
            <Link to="/shop" className="text-primary underline">
              Mulai jelajahi katalog
            </Link>
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((w) => (
            <Card key={w.id}>
              <Link to="/product/$slug" params={{ slug: w.products?.slug ?? "" }}>
                <div className="aspect-[4/5] bg-muted overflow-hidden mb-3">
                  {w.products?.cover_image_url && (
                    <img
                      src={w.products.cover_image_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>
              </Link>
              <h3 className="font-semibold truncate">{w.products?.name}</h3>
              <p className="text-xs text-muted-foreground">{w.products?.team}</p>
              <p className="text-sm font-semibold mt-1">{formatIDR(w.products?.price ?? 0)}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    addToCart.mutate(
                      { product_id: w.product_id },
                      {
                        onSuccess: () =>
                          toast.success("Berhasil ditambahkan ke keranjang", {
                            action: {
                              label: "Lihat Keranjang",
                              onClick: () => navigate({ to: "/cart" }),
                            },
                          }),
                      },
                    )
                  }
                >
                  + Cart
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(w.product_id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
