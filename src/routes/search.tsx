import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = useSearch({ from: "/search" });
  const [val, setVal] = useState(q);
  const query = useQuery({
    queryKey: ["search", val],
    queryFn: async () => {
      if (!val) return [];
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${val}%,team.ilike.%${val}%,league.ilike.%${val}%,country.ilike.%${val}%`);
      return data ?? [];
    },
  });
  return (
    <>
      <Navbar />
      <main id="main-content" className="pt-28 md:pt-36 pb-20 container-swiss min-h-screen">
        <h1 className="display-lg">Pencarian</h1>
        <div className="mt-6 max-w-xl">
          <Label htmlFor="search-input" className="sr-only">
            Cari jersey
          </Label>
          <Input
            id="search-input"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="Cari klub, pemain, tahun, kompetisi..."
          />
        </div>
        <div className="mt-10">
          {!val ? (
            <p className="text-muted-foreground">Ketik kata kunci untuk mencari jersey.</p>
          ) : query.data?.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 sm:gap-6">
              {query.data.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Tidak ada hasil untuk &ldquo;{val}&rdquo;.</p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
