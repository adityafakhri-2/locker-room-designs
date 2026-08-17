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
  grade_ori: "Grade Ori",
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
            <div className="size-full grid place-items-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </Link>
      </div>

      {/* Detail info & interaksi di bawah gambar */}
      <div className="pt-3 flex flex-col gap-1.5">
        {/* Baris 1: Label Keaslian & Tombol Wishlist (Hati) */}
        <div className="flex items-center justify-between gap-2">
          {p.authenticity_badge ? (
            <span
              title={BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}
              className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 eyebrow text-[9px] md:text-[10px] select-none text-muted-foreground truncate max-w-[70%]"
            >
              <span className="size-1 shrink-0 bg-primary rounded-full" />
              <span className="truncate">
                {BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}
              </span>
            </span>
          ) : (
            <div />
          )}

          <button
            aria-label={liked ? "Hapus dari Wishlist" : "Tambah ke Wishlist"}
            onClick={(e) => {
              e.preventDefault();
              if (!user) {
                toast.error("Silakan masuk terlebih dahulu");
                navigate({ to: "/auth" });
                return;
              }
              toggle.mutate(p.id);
            }}
            className="grid place-items-center size-8 md:size-9 rounded-full bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none shrink-0"
          >
            <Heart
              className={cn("size-3.5 md:size-4", liked && "fill-primary text-primary")}
              strokeWidth={1.5}
            />
          </button>
        </div>

        {/* Baris 2: Nama Produk & Harga */}
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3"
        >
          <h3 className="text-sm md:text-base font-semibold tracking-tight truncate">{p.name}</h3>
          <span className="text-sm font-semibold tabular-nums">{formatIDR(p.price)}</span>
        </Link>

        {/* Baris 3: Tim/Tahun & Custom Footer */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
          <span className="text-xs text-muted-foreground truncate">
            {[p.team, p.release_year].filter(Boolean).join(" · ")}
          </span>
          {footer}
        </div>
      </div>
    </article>
  );
}
