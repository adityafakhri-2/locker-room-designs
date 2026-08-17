import { ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import img from "@/assets/vintage-spotlight.jpg";

const BADGE_LABEL: Record<string, string> = {
  original_verified: "Original Verified",
  match_worn: "Match Worn",
  collector_item: "Collector Item",
  limited_edition: "Limited Edition",
};

export function VintageSpotlight() {
  const q = useQuery({
    queryKey: ["vintage-spotlight-product"],
    queryFn: async () => {
      // 1. Fetch retro and vintage category IDs
      const { data: cats, error: errCats } = await supabase
        .from("categories")
        .select("id")
        .in("slug", ["retro", "vintage"]);

      if (errCats) throw errCats;
      const catIds = cats?.map((c) => c.id) || [];

      let spotlightProduct = null;

      if (catIds.length > 0) {
        // Query the most expensive product in retro/vintage categories
        const { data: prod, error: errProd } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .overlaps("category_ids", catIds)
          .order("price", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!errProd && prod) {
          spotlightProduct = prod;
        }
      }

      // If not found in retro/vintage, query the most expensive product overall
      if (!spotlightProduct) {
        const { data: prod, error: errProd } = await supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("price", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (errProd) throw errProd;
        spotlightProduct = prod;
      }

      return spotlightProduct;
    },
    staleTime: 1000 * 15,
  });

  const p = q.data;

  // Static Fallback Data
  const titleTeam = "Manchester United";
  const titleSub = "Treble Winners 98/99.";
  const description =
    "Jersey ini menjadi saksi musim paling bersejarah Manchester United saat meraih Treble Winners pada tahun 1999 — Premier League, FA Cup, dan UEFA Champions League dalam satu musim.";
  const coverImage = img;

  const displayTeam = p ? p.team || p.name : titleTeam;
  const displaySub = p
    ? p.team && p.team.toLowerCase() !== p.name.toLowerCase()
      ? p.name.replace(new RegExp(`^${p.team}\\s*`, "i"), "")
      : ""
    : titleSub;
  const displayDesc = p ? p.description || p.story || "" : description;
  const displayCover = p?.cover_image_url || coverImage;

  const scoreMap = ["A", "AA", "AAA"];
  const displayScore = p ? scoreMap[Math.min(Math.max(p.collector_score - 1, 0), 2)] : "AAA";

  const meta = [
    { k: "Condition Rating", v: p ? p.condition || "BNWT" : "9.2 / 10" },
    { k: "Collector Score", v: displayScore },
    { k: "Year", v: p ? String(p.release_year || "") : "1998 / 1999" },
    {
      k: "Authenticity",
      v: p ? BADGE_LABEL[p.authenticity_badge || ""] || "Terverifikasi" : "Certificate Included",
    },
  ];

  return (
    <section id="vintage" className="bg-foreground text-background border-t border-foreground">
      <div className="container-swiss py-20 md:py-28 lg:py-36">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 mb-12 md:mb-16">
          <span className="eyebrow text-white/70">N° 05 — Vintage Spotlight</span>
          <span className="eyebrow text-white/70">Koleksi Klasik</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-7 relative aspect-[16/11] overflow-hidden bg-foreground">
            <img
              src={displayCover}
              alt={`${displayTeam} ${displaySub} jersey`}
              loading="lazy"
              width={1600}
              height={1200}
              className="size-full object-cover"
            />
          </div>

          <div className="lg:col-span-5">
            <span className="eyebrow text-primary font-bold tracking-wider">
              Legenda yang Bisa Kamu Miliki
            </span>
            <h2 className="display-lg mt-4 text-white leading-tight">
              {displayTeam}
              {displaySub && (
                <>
                  <br />
                  <span className="italic font-light text-2xl md:text-3xl lg:text-4xl block mt-2">
                    {displaySub}
                  </span>
                </>
              )}
            </h2>
            <p className="mt-6 text-white/75 leading-relaxed line-clamp-6" title={displayDesc}>
              {displayDesc}
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-px bg-white/15">
              {meta.map((m) => (
                <div key={m.k} className="bg-foreground p-5">
                  <dt className="eyebrow text-white/60">{m.k}</dt>
                  <dd className="mt-2 text-base font-semibold text-white">{m.v}</dd>
                </div>
              ))}
            </dl>

            {p ? (
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="mt-10 inline-flex items-center gap-3 bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold tracking-wide hover:bg-secondary transition-colors"
              >
                Lihat Detail Koleksi
                <ArrowUpRight className="size-4" />
              </Link>
            ) : (
              <a
                href="#new-arrivals"
                className="mt-10 inline-flex items-center gap-3 bg-primary text-primary-foreground px-6 py-4 text-sm font-semibold tracking-wide hover:bg-secondary transition-colors"
              >
                Lihat Detail Koleksi
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
