import { ArrowUpRight, Sparkles, Tag, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { formatIDR } from "@/lib/format";
import img from "@/assets/vintage-spotlight.jpg";

const BADGE_LABEL: Record<string, string> = {
  original_verified: "Original Resmi 100%",
  grade_ori: "Grade Ori Import 1:1",
  match_worn: "Match Worn",
  collector_item: "Collector Item",
  limited_edition: "Limited Edition",
};

export function VintageSpotlight() {
  const q = useQuery({
    queryKey: ["homepage-spotlight-product"],
    queryFn: async () => {
      // 1. First priority: Check if admin explicitly marked a product as spotlight
      const { data: spotlightProd, error: spotErr } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("is_spotlight", true)
        .limit(1)
        .maybeSingle();

      if (!spotErr && spotlightProd) {
        return spotlightProd;
      }

      // 2. Fallback: Jika admin belum menandai spotlight, ambil jersey aktif yang PALING BARU ditambahkan
      const { data: fallbackProd } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return fallbackProd || null;
    },
    staleTime: 1000 * 15,
  });

  const p = q.data;

  // Fallback Data
  const titleTeam = "FC Barcelona";
  const titleSub = "2026/27 Away Edition.";
  const description =
    "Jersey pilihan terbaik minggu ini dengan kualitas bahan dry-fit premium, detail bordir logo presisi, dan kenyamanan optimal untuk olahraga maupun gaya kasual harian Anda.";
  const coverImage = img;

  const displayTeam = p ? p.team || p.name : titleTeam;
  const displaySub = p
    ? p.team && p.team.toLowerCase() !== p.name.toLowerCase()
      ? p.name.replace(new RegExp(`^${p.team}\\s*`, "i"), "")
      : p.name
    : titleSub;
  const displayDesc = p ? p.description || p.story || description : description;
  const displayCover = p?.cover_image_url || coverImage;

  const numPrice = p ? Number(p.price) : 120000;
  const numOriginal = p?.original_price ? Number(p.original_price) : 0;
  const hasDiscount = numOriginal > numPrice;
  const discountPercent = hasDiscount
    ? Math.round(((numOriginal - numPrice) / numOriginal) * 100)
    : 0;

  const qualityLabel = p?.authenticity_badge
    ? BADGE_LABEL[p.authenticity_badge] || p.authenticity_badge
    : "Grade Ori Import 1:1";

  const sizeList = p?.sizes && p.sizes.length > 0 ? p.sizes.join(", ") : "S, M, L, XL, XXL";

  const meta = [
    { k: "Kualitas Jersey", v: qualityLabel },
    {
      k: "Harga Promo",
      v: (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-primary font-bold">{formatIDR(numPrice)}</span>
          {hasDiscount && (
            <span className="text-xs text-white/50 line-through">
              {formatIDR(numOriginal)} (-{discountPercent}%)
            </span>
          )}
        </div>
      ),
    },
    { k: "Musim / Rilis", v: p?.release_year ? String(p.release_year) : "Musim Terbaru" },
    { k: "Pilihan Ukuran", v: sizeList },
  ];

  return (
    <section id="spotlight" className="bg-foreground text-background border-t border-foreground">
      <div className="container-swiss py-20 md:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12 md:mb-16">
          <span className="eyebrow text-white/70 flex items-center gap-2">
            <Sparkles className="size-3.5 text-primary" />
            N° 05 — Spotlight of the Week
          </span>
          <span className="eyebrow text-white font-bold">Rekomendasi Spesial</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-7 relative aspect-[4/3] md:aspect-[16/11] overflow-hidden bg-muted/10 rounded-lg border border-white/10 shadow-2xl">
            {hasDiscount && (
              <div className="absolute top-4 left-4 z-10 bg-rose-600 text-white font-black text-xs px-3 py-1 rounded shadow-lg uppercase tracking-wider">
                PROMO DISKON -{discountPercent}%
              </div>
            )}
            <img
              src={displayCover}
              alt={`${displayTeam} ${displaySub} jersey`}
              loading="lazy"
              width={1600}
              height={1200}
              className="size-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>

          <div className="lg:col-span-5">
            <span className="eyebrow text-primary font-bold tracking-wider">
              PILIHAN UTAMA MINGGU INI
            </span>
            <h2 className="display-lg mt-4 text-white leading-tight">
              {displayTeam}
              {displaySub && displaySub !== displayTeam && (
                <>
                  <br />
                  <span className="italic font-light text-2xl md:text-3xl lg:text-4xl block mt-2 text-white/90">
                    {displaySub}
                  </span>
                </>
              )}
            </h2>
            <p className="mt-5 text-white/75 leading-relaxed line-clamp-4 text-sm md:text-base" title={displayDesc}>
              {displayDesc}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-px bg-white/15 rounded-lg overflow-hidden border border-white/15">
              {meta.map((m) => (
                <div key={m.k} className="bg-foreground/90 p-4">
                  <dt className="eyebrow text-white/50 text-[10px] md:text-xs">{m.k}</dt>
                  <dd className="mt-1.5 text-sm md:text-base font-semibold text-white">
                    {m.v}
                  </dd>
                </div>
              ))}
            </dl>

            {p ? (
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="mt-8 inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground px-7 py-4 text-sm font-bold tracking-wide rounded-md hover:bg-secondary transition-all shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5"
              >
                Lihat Detail & Pesan Sekarang
                <ArrowUpRight className="size-4" />
              </Link>
            ) : (
              <Link
                to="/shop"
                className="mt-8 inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground px-7 py-4 text-sm font-bold tracking-wide rounded-md hover:bg-secondary transition-all shadow-lg hover:shadow-primary/20"
              >
                Jelajahi Semua Produk
                <ArrowUpRight className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section >
  );
}
