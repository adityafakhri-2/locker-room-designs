import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section } from "./Section";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/commerce/ProductCard";

function EmptyCatalog() {
  return (
    <div className="border border-dashed border-border p-12 text-center">
      <p className="text-muted-foreground">
        Katalog masih kosong. Admin dapat menambahkan produk dari panel admin.
      </p>
      <Link to="/shop" className="text-sm text-primary mt-3 inline-block underline">
        Lihat katalog →
      </Link>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="relative aspect-[4/5] bg-muted w-full" />
      <div className="pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between items-center gap-2">
          <div className="h-4 bg-muted w-24 rounded" />
          <div className="size-8 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div className="h-5 bg-muted rounded w-3/4" />
          <div className="h-5 bg-muted rounded" />
        </div>
        <div className="h-4 bg-muted rounded w-1/2" />
      </div>
    </div>
  );
}

function getProductRealStock(p: any): number {
  const raw = p?.size_stock as Record<string, any> | null;
  if (raw && typeof raw === "object") {
    const entries = Object.entries(raw).filter(([k]) => !k.startsWith("_"));
    if (entries.length > 0) {
      return entries.reduce((acc, [, val]) => acc + (Number(val) || 0), 0);
    }
  }
  return Number(p?.stock) || 0;
}

export function NewArrivals() {
  const q = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, price, original_price, cover_image_url, team, release_year, authenticity_badge, sold_count, stock, size_stock",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data.filter((p) => getProductRealStock(p) > 0).slice(0, 4);
    },
    staleTime: 1000 * 10,
  });

  const products = q.data ?? [];

  return (
    <Section id="new-arrivals" eyebrow="N° 03 — Produk Terbaru" number="Rilisan Baru">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Koleksi <span className="italic font-light">terbaru.</span>
        </h2>
        <div className="lg:col-span-5 flex lg:justify-end items-end">
          <Link
            to="/shop"
            className="text-sm font-semibold hover:opacity-60 transition-opacity border-b-2 border-foreground pb-1"
          >
            Lihat Semua Produk →
          </Link>
        </div>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyCatalog />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function BestSellers() {
  const q = useQuery({
    queryKey: ["best-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, slug, name, price, original_price, cover_image_url, team, release_year, authenticity_badge, sold_count, stock, size_stock",
        )
        .eq("is_active", true)
        .gt("sold_count", 0)
        .order("sold_count", { ascending: false })
        .limit(50);

      if (error || !data) return [];
      return data.filter((p) => getProductRealStock(p) > 0).slice(0, 4);
    },
    staleTime: 1000 * 10,
  });

  const products = q.data ?? [];

  if (q.isLoading) {
    return (
      <Section eyebrow="N° 04 — Produk Terlaris" number="Paling Diminati">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <h2 className="lg:col-span-7 display-lg">
            Paling diminati <span className="italic font-light">saat ini.</span>
          </h2>
          <div className="lg:col-span-5 flex lg:justify-end items-end">
            <Link
              to="/shop"
              search={{ sort: "best" }}
              className="text-sm font-semibold hover:opacity-60 transition-opacity border-b-2 border-foreground pb-1"
            >
              Lihat Semua Terlaris →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </Section>
    );
  }

  if (products.length === 0) return null;

  return (
    <Section eyebrow="N° 04 — Produk Terlaris" number="Paling Diminati">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Paling diminati <span className="italic font-light">saat ini.</span>
        </h2>
        <div className="lg:col-span-5 flex lg:justify-end items-end">
          <Link
            to="/shop"
            search={{ sort: "best" }}
            className="text-sm font-semibold hover:opacity-60 transition-opacity border-b-2 border-foreground pb-1"
          >
            Lihat Semua Terlaris →
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            p={p}
            footer={
              p.sold_count ? (
                <span className="text-xs text-primary font-medium">Terjual {p.sold_count}×</span>
              ) : undefined
            }
          />
        ))}
      </div>
    </Section>
  );
}
