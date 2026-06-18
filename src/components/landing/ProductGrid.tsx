import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Section } from "./Section";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/commerce/ProductCard";

function EmptyCatalog() {
  return (
    <div className="border border-dashed border-border p-12 text-center">
      <p className="text-muted-foreground">Katalog masih kosong. Admin dapat menambahkan produk dari panel admin.</p>
      <Link to="/shop" className="text-sm text-primary mt-3 inline-block underline">Lihat katalog →</Link>
    </div>
  );
}

export function NewArrivals() {
  const q = useQuery({
    queryKey: ["new-arrivals"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(4)).data ?? [],
  });
  return (
    <Section id="new-arrivals" eyebrow="N° 04 — New Arrivals" number="Koleksi Terbaru">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">Koleksi <span className="italic font-light">terbaru.</span></h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Drop terbaru. Setiap kit telah melalui pemeriksaan keaslian sebelum masuk ke katalog.
        </p>
      </div>
      {q.data && q.data.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {q.data.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : <EmptyCatalog />}
    </Section>
  );
}

export function BestSellers() {
  const q = useQuery({
    queryKey: ["best-sellers"],
    queryFn: async () => (await supabase.from("products").select("*").eq("is_active", true).order("sold_count", { ascending: false }).limit(4)).data ?? [],
  });
  const hasSales = (q.data ?? []).some((p) => (p.sold_count ?? 0) > 0);
  if (!hasSales) return null;
  return (
    <Section eyebrow="N° 05 — Best Sellers" number="Paling Dicari">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <h2 className="lg:col-span-7 display-lg">Paling dicari <span className="italic font-light">minggu ini.</span></h2>
        <p className="lg:col-span-4 lg:col-start-9 text-muted-foreground self-end max-w-md">
          Stok terbatas dan terus berkurang. Klik dua kali untuk amankan sebelum kehabisan.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {q.data!.map((p) => (
          <ProductCard key={p.id} p={p} footer={p.sold_count ? <span className="text-xs text-primary font-medium">Terjual {p.sold_count}×</span> : undefined} />
        ))}
      </div>
    </Section>
  );
}
