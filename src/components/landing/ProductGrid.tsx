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

export function NewArrivals() {
  const q = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("id, slug, name, price, cover_image_url, team, release_year, authenticity_badge, sold_count")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(4)
      ).data ?? [],
    staleTime: 1000 * 10,
  });

  return (
    <Section id="new-arrivals" eyebrow="N° 04 — New Arrivals" number="Koleksi Terbaru">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Koleksi <span className="italic font-light">terbaru.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Drop terbaru. Setiap kit telah melalui pemeriksaan keaslian sebelum masuk ke katalog.
        </p>
      </div>
      {q.isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : q.data && q.data.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
          {q.data.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <EmptyCatalog />
      )}
    </Section>
  );
}

export function BestSellers() {
  const q = useQuery({
    queryKey: ["best-sellers"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("id, slug, name, price, cover_image_url, team, release_year, authenticity_badge, sold_count")
          .eq("is_active", true)
          .order("sold_count", { ascending: false })
          .limit(4)
      ).data ?? [],
    staleTime: 1000 * 10,
  });

  const hasSales = (q.data ?? []).some((p) => (p.sold_count ?? 0) > 0);

  if (q.isLoading) {
    return (
      <Section eyebrow="N° 05 — Best Sellers" number="Paling Dicari">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <h2 className="lg:col-span-7 display-lg">
            Paling dicari <span className="italic font-light">minggu ini.</span>
          </h2>
          <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
            Stok terbatas dan terus berkurang. Klik dua kali untuk amankan sebelum kehabisan.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </Section>
    );
  }

  if (!hasSales) return null;

  return (
    <Section eyebrow="N° 05 — Best Sellers" number="Paling Dicari">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">
          Paling dicari <span className="italic font-light">minggu ini.</span>
        </h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Stok terbatas dan terus berkurang. Klik dua kali untuk amankan sebelum kehabisan.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
        {q.data!.map((p) => (
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
