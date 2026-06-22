import { ArrowUpRight } from "lucide-react";
import { Section } from "./Section";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import newSeason from "@/assets/collection-new-season.jpg";
import vintage from "@/assets/collection-vintage.jpg";
import retro from "@/assets/collection-retro.jpg";
import limited from "@/assets/collection-limited.jpg";

const STATIC_IMAGE_MAPPING: Record<string, string> = {
  "new-season": newSeason,
  "vintage": vintage,
  "retro": retro,
  "limited-edition": limited,
};

const FALLBACK_COLLECTIONS = [
  { slug: "new-season", title: "New Season Jerseys", subtitle: "Koleksi jersey musim terbaru dari klub dan tim nasional favorit.", cover_url: newSeason, latest_product_cover_url: null as string | null },
  { slug: "vintage", title: "Vintage Jerseys", subtitle: "Jersey bersejarah yang membawa kembali kenangan sepak bola.", cover_url: vintage, latest_product_cover_url: null as string | null },
  { slug: "retro", title: "Retro Collection", subtitle: "Reproduksi jersey legendaris dari era keemasan sepak bola.", cover_url: retro, latest_product_cover_url: null as string | null },
  { slug: "limited-edition", title: "Limited Edition", subtitle: "Koleksi eksklusif dengan jumlah terbatas.", cover_url: limited, latest_product_cover_url: null as string | null },
];

export function FeaturedCollections() {
  const q = useQuery({
    queryKey: ["featured-collections"],
    queryFn: async () => {
      const { data: cols, error: errCols } = await supabase
        .from("featured_collections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (errCols) throw errCols;

      const { data: cats, error: errCats } = await supabase
        .from("categories")
        .select("id, slug");
      if (errCats) throw errCats;

      const targetCols = cols && cols.length > 0 ? cols : [
        { slug: "new-season", title: "New Season Jerseys", subtitle: "Koleksi jersey musim terbaru dari klub dan tim nasional favorit.", cover_url: null },
        { slug: "vintage", title: "Vintage Jerseys", subtitle: "Jersey bersejarah yang membawa kembali kenangan sepak bola.", cover_url: null },
        { slug: "retro", title: "Retro Collection", subtitle: "Reproduksi jersey legendaris dari era keemasan sepak bola.", cover_url: null },
        { slug: "limited-edition", title: "Limited Edition", subtitle: "Koleksi eksklusif dengan jumlah terbatas.", cover_url: null },
      ];

      const colsWithCovers = await Promise.all(
        targetCols.map(async (col) => {
          const category = cats?.find((cat) => cat.slug === col.slug);
          if (!category) return { ...col, latest_product_cover_url: null as string | null };

          const { data: latestProd } = await supabase
            .from("products")
            .select("cover_image_url")
            .eq("is_active", true)
            .contains("category_ids", [category.id])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...col,
            latest_product_cover_url: latestProd?.cover_image_url || null,
          };
        })
      );

      return colsWithCovers;
    },
  });

  const list = q.data && q.data.length > 0 ? q.data : FALLBACK_COLLECTIONS;

  return (
    <Section id="collections" eyebrow="N° 03 — Collections" number="Temukan Koleksi">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Temukan koleksi <span className="italic font-light">favoritmu.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Empat pintu masuk ke arsip jersey kami — dari kit musim ini hingga
          potongan langka yang sulit ditemukan di pasar lain.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {list.map((c, idx) => {
          const cover = c.cover_url || STATIC_IMAGE_MAPPING[c.slug] || newSeason;
          const tag = String(idx + 1).padStart(2, "0");
          return (
            <Link key={c.slug} to="/shop" search={{ category: c.slug }} className="group flex flex-col">
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                <img
                  src={cover}
                  alt={c.title}
                  loading="lazy"
                  width={1024}
                  height={1280}
                  className="size-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
                <span className="absolute top-4 left-4 eyebrow text-white mix-blend-difference">
                  {tag}
                </span>
                <span className="absolute bottom-4 right-4 size-10 grid place-items-center bg-background/95 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <div className="pt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-baseline">
                <h3 className="text-base md:text-lg font-extrabold tracking-tight">{c.title}</h3>
                <span className="eyebrow text-muted-foreground">Shop</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{c.subtitle}</p>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}
