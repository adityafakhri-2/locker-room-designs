import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { formatIDR } from "@/lib/format";
import { useToggleWishlist, useWishlist } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  price: number | string;
  cover_image_url?: string | null;
  team?: string | null;
  release_year?: number | null;
  authenticity_badge?: string | null;
  sold_count?: number | null;
}

const BADGE_LABEL: Record<string, string> = {
  original_verified: "Original Terverifikasi",
  match_worn: "Jersey Pertandingan (Match Worn)",
  collector_item: "Barang Koleksi (Collector Item)",
  limited_edition: "Edisi Terbatas (Limited Edition)",
};

export function ProductCard({ p, footer }: { p: ProductCardData; footer?: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: wl } = useWishlist();
  const toggle = useToggleWishlist();
  const liked = wl?.some((w) => w.product_id === p.id) ?? false;

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full">
          {p.cover_image_url ? (
            <img
              src={p.cover_image_url}
              alt={p.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
            />
          ) : (
            <div className="size-full grid place-items-center text-muted-foreground text-xs">No image</div>
          )}
        </Link>
        {p.authenticity_badge && (
          <span
            title={BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}
            className="absolute top-3 left-3 max-w-[calc(100%-4rem)] inline-flex items-center gap-1.5 bg-background/95 px-2.5 py-1 eyebrow text-[10px] select-none"
          >
            <span className="size-1.5 shrink-0 bg-primary" />
            <span className="truncate">{BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}</span>
          </span>
        )}
        <button
          aria-label="Wishlist"
          onClick={(e) => {
            e.preventDefault();
            if (!user) {
              toast.error("Silakan masuk terlebih dahulu");
              navigate({ to: "/auth" });
              return;
            }
            toggle.mutate(p.id);
          }}
          className="absolute top-3 right-3 grid place-items-center size-8 bg-background/95 hover:bg-background"
        >
          <Heart className={cn("size-3.5", liked && "fill-primary text-primary")} strokeWidth={1.5} />
        </button>
      </div>
      <Link to="/product/$slug" params={{ slug: p.slug }} className="pt-4 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
        <h3 className="text-sm md:text-base font-semibold tracking-tight truncate">{p.name}</h3>
        <span className="text-sm font-semibold tabular-nums">{formatIDR(p.price)}</span>
      </Link>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 mt-1">
        <span className="text-xs text-muted-foreground truncate">{[p.team, p.release_year].filter(Boolean).join(" · ")}</span>
        {footer}
      </div>
    </article>
  );
}
