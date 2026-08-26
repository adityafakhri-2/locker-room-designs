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
  original_price?: number | string | null;
  cover_image_url?: string | null;
  team?: string | null;
  release_year?: number | null;
  authenticity_badge?: string | null;
  sold_count?: number | null;
  stock?: number | null;
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

  return (
    <article className="group flex flex-col h-full bg-card rounded-lg overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-md transition-all duration-300">
      <div className="relative aspect-[4/5] overflow-hidden bg-muted">
        {/* Discount Badge on Image */}
        {hasDiscount && !isOutOfStock && (
          <div className="absolute top-2.5 left-2.5 z-10 bg-rose-600 text-white font-black text-[10px] md:text-xs px-2 py-0.5 rounded shadow-md tracking-tight uppercase animate-fade-in">
            -{discountPercent}%
          </div>
        )}

        {/* Out of Stock Overlay on Image */}
        {isOutOfStock && (
          <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center pointer-events-none">
            <span className="px-2.5 py-1 bg-rose-600/95 text-white font-extrabold text-[11px] md:text-xs tracking-wider uppercase rounded shadow-lg">
              STOK HABIS
            </span>
            <span className="text-[10px] text-zinc-200 mt-1 font-medium">
              Lihat Detail Produk
            </span>
          </div>
        )}

        <Link to="/product/$slug" params={{ slug: p.slug }} className="block size-full">
          {p.cover_image_url ? (
            <img
              src={p.cover_image_url}
              alt={p.name}
              loading="lazy"
              className={cn(
                "size-full object-cover transition-transform duration-[800ms] ease-out group-hover:scale-105",
                isOutOfStock && "grayscale-[40%] opacity-75",
              )}
            />
          ) : (
            <div className="size-full grid place-items-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </Link>
      </div>

      {/* Detail info & interaksi di bawah gambar */}
      <div className="p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          {/* Baris 1: Label Keaslian & Tombol Wishlist (Hati) */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {p.authenticity_badge ? (
              <span
                title={BADGE_LABEL[p.authenticity_badge] ?? p.authenticity_badge}
                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold text-[9px] md:text-[10px] uppercase tracking-wide select-none truncate max-w-[75%]"
              >
                <span className="size-1.5 shrink-0 bg-primary rounded-full" />
                <span className="truncate font-bold">
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

        {/* Bagian Bawah: Harga Highlight & Status Terjual */}
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

          {/* Baris Harga Menonjol & Terjual */}
          <div className="flex items-baseline justify-between gap-2">
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

            <div className="text-right">
              {footer ? (
                footer
              ) : isSold ? (
                <span className="text-[10px] md:text-xs text-muted-foreground tabular-nums font-medium">
                  {p.sold_count} terjual
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
