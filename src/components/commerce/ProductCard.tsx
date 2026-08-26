import { Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
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
  original_price?: number | string | null;
  cover_image_url?: string | null;
  team?: string | null;
  release_year?: number | null;
  authenticity_badge?: string | null;
  sold_count?: number | null;
  stock?: number | null;
  sizes?: string[] | string | null;
  size_stock?: Record<string, any> | null;
}

const BADGE_LABEL: Record<string, string> = {
  original_verified: "Original Terverifikasi",
  grade_ori: "Grade Ori",
  match_worn: "Jersey Pertandingan (Match Worn)",
  collector_item: "Barang Koleksi (Collector Item)",
  limited_edition: "Edisi Terbatas (Limited Edition)",
};

function formatNumber(val: number | string): string {
  const num = Number(val) || 0;
  return num.toLocaleString("id-ID");
}

export function ProductCard({ p, footer }: { p: ProductCardData; footer?: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: wl } = useWishlist();
  const toggle = useToggleWishlist();
  const liked = wl?.some((w) => w.product_id === p.id) ?? false;

  const numPrice = Number(p.price) || 0;
  const numOriginal = p.original_price ? Number(p.original_price) : 0;
  const hasDiscount = numOriginal > numPrice;
  const discountPercent = hasDiscount
    ? Math.round(((numOriginal - numPrice) / numOriginal) * 100)
    : 0;

  const isSold =
    p.sold_count !== undefined && p.sold_count !== null && Number(p.sold_count) >= 1;

  const rawSizeStock = (p as any).size_stock as Record<string, any> | null;
  let totalCalculatedStock = Number(p.stock) || 0;
  if (rawSizeStock && typeof rawSizeStock === "object") {
    const stockEntries = Object.entries(rawSizeStock).filter(([k]) => !k.startsWith("_"));
    if (stockEntries.length > 0) {
      const sum = stockEntries.reduce((acc, [, val]) => acc + (Number(val) || 0), 0);
      totalCalculatedStock = sum;
    }
  }

  const isOutOfStock = totalCalculatedStock <= 0;

  // Extract available sizes
  const availableSizes: string[] = useMemo(() => {
    if (rawSizeStock && typeof rawSizeStock === "object") {
      const stockEntries = Object.entries(rawSizeStock).filter(([k]) => !k.startsWith("_"));
      if (stockEntries.length > 0) {
        return stockEntries
          .filter(([, qty]) => Number(qty) > 0)
          .map(([size]) => size);
      }
    }
    const rawSizes = (p as any).sizes;
    if (Array.isArray(rawSizes)) {
      return rawSizes;
    }
    if (typeof rawSizes === "string") {
      return rawSizes.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  }, [rawSizeStock, (p as any).sizes]);

  return (
    <article className="group flex flex-col h-full bg-card rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {/* Discount Badge on Image */}
        {hasDiscount && !isOutOfStock && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black bg-rose-600 text-white shadow-sm tracking-tight">
              -{discountPercent}%
            </span>
          </div>
        )}

        {/* Product Image */}
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="block w-full h-full"
        >
          {p.cover_image_url ? (
            <img
              src={p.cover_image_url}
              alt={p.name}
              className={cn(
                "w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out",
                isOutOfStock && "grayscale opacity-60"
              )}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-xs font-mono">
              [NO IMAGE]
            </div>
          )}
        </Link>

        {/* Out of Stock Overlay Badge */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <span className="px-3 py-1 bg-zinc-900/90 text-white text-[11px] font-extrabold uppercase tracking-wider rounded shadow">
              Stok Habis
            </span>
          </div>
        )}
      </div>

      <div className="p-3 md:p-3.5 flex flex-col flex-1 gap-2">
        {/* Baris 1: Kategori / Badge Kualitas & Wishlist */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {p.authenticity_badge && (
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 leading-none",
                    p.authenticity_badge === "original_verified" &&
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
                    p.authenticity_badge === "grade_ori" &&
                      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
                    p.authenticity_badge === "match_worn" &&
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                    p.authenticity_badge === "collector_item" &&
                      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20",
                    p.authenticity_badge === "limited_edition" &&
                      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}
                </span>
              )}
            </div>

            {/* Wishlist Button */}
            <button
              type="button"
              aria-label={liked ? "Hapus dari wishlist" : "Simpan ke wishlist"}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!user) {
                  toast.error("Silakan masuk terlebih dahulu");
                  navigate({ to: "/auth" });
                  return;
                }
                toggle.mutate(p.id);
              }}
              className="grid place-items-center size-7 md:size-8 rounded-full bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-primary transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none shrink-0"
            >
              <Heart
                className={cn("size-3.5 md:size-4", liked && "fill-primary text-primary")}
                strokeWidth={1.5}
              />
            </button>
          </div>

          {/* Baris 2: Nama Produk */}
          <Link
            to="/product/$slug"
            params={{ slug: p.slug }}
            className="block group/title"
          >
            <h3 className="text-xs md:text-sm font-semibold tracking-tight text-foreground group-hover/title:text-primary transition-colors line-clamp-2 leading-snug">
              {p.name}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {[p.team, p.release_year].filter(Boolean).join(" · ")}
            </p>
          </Link>
        </div>

        {/* Bagian Bawah: Harga Highlight & Status Terjual / Size Pills */}
        <div className="pt-1 mt-auto">
          {/* Harga Coret & Diskon */}
          {hasDiscount && (
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] text-muted-foreground line-through tabular-nums leading-none">
                Rp{formatNumber(numOriginal)}
              </span>
              <span className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1 py-0.2 rounded leading-none">
                -{discountPercent}%
              </span>
            </div>
          )}

          {/* Baris Harga Menonjol & Terjual / Size Pills */}
          <div className="flex items-end justify-between gap-2">
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="inline-flex items-baseline text-primary hover:opacity-85 transition-opacity"
            >
              <span className="text-xs md:text-sm font-bold text-primary mr-0.5 tracking-tighter">
                Rp
              </span>
              <span className="text-base md:text-lg lg:text-xl font-black text-primary tracking-tight tabular-nums font-mono">
                {formatNumber(p.price)}
              </span>
            </Link>

            <div className="text-right flex flex-col items-end gap-1 shrink-0">
              {footer ? (
                footer
              ) : isOutOfStock ? (
                <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded leading-none">
                  Habis
                </span>
              ) : (
                <>
                  {availableSizes.length > 0 && (
                    <div className="flex items-center gap-0.5 flex-wrap justify-end">
                      {availableSizes.slice(0, 4).map((sz) => (
                        <span
                          key={sz}
                          className="text-[9px] font-bold px-1 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/60 group-hover:border-primary/40 group-hover:text-foreground transition-colors leading-none"
                        >
                          {sz}
                        </span>
                      ))}
                      {availableSizes.length > 4 && (
                        <span className="text-[9px] text-muted-foreground font-semibold px-0.5 leading-none">
                          +{availableSizes.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {isSold && (
                    <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                      {p.sold_count} terjual
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
