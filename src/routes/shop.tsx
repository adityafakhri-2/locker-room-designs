import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Section } from "@/components/landing/Section";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [
    { title: "Shop — The Locker Room" },
    { name: "description", content: "Katalog jersey original, vintage, retro, dan limited edition di The Locker Room." },
  ] }),
  validateSearch: (search: Record<string, unknown>) => ({
    category: (search.category as string) || "all",
    sort: (search.sort as string) || "newest",
    q: (search.q as string) || "",
  }),
  component: ShopPage,
});

function ShopPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const category = search.category || "all";
  const sort = search.sort || "newest";
  const q = search.q || "";

  const setCategory = (val: string) => navigate({ search: (prev) => ({ ...prev, category: val }) });
  const setSort = (val: string) => navigate({ search: (prev) => ({ ...prev, sort: val }) });
  const setQ = (val: string) => navigate({ search: (prev) => ({ ...prev, q: val }) });

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const activeCategoryObject = useMemo(() => {
    return cats.data?.find((c) => c.slug === category || c.id === category);
  }, [category, cats.data]);

  const activeCategoryId = activeCategoryObject?.id || "all";

  const products = useQuery({
    queryKey: ["products", activeCategoryId, sort, q],
    queryFn: async () => {
      let qy = supabase.from("products").select("*").eq("is_active", true);
      if (activeCategoryId !== "all") qy = qy.contains("category_ids", [activeCategoryId]);
      if (q) qy = qy.ilike("name", `%${q}%`);
      if (sort === "price_low") qy = qy.order("price", { ascending: true });
      else if (sort === "price_high") qy = qy.order("price", { ascending: false });
      else if (sort === "best") qy = qy.order("sold_count", { ascending: false });
      else qy = qy.order("created_at", { ascending: false });
      const { data } = await qy;
      return data ?? [];
    },
  });

  const list = products.data ?? [];
  const empty = !products.isLoading && list.length === 0;
  const heading = useMemo(() => activeCategoryObject?.name ?? "Semua Jersey", [activeCategoryObject]);

  return (
    <>
      <Navbar />
      <Section bare className="pt-28 md:pt-36 pb-20 md:pb-28">
        <div className="container-swiss">
          <div className="grid lg:grid-cols-12 gap-10 mb-12">
            <div className="lg:col-span-7">
              <span className="eyebrow text-muted-foreground">N° 01 — Catalog</span>
              <h1 className="display-lg mt-3">{heading}</h1>
              <p className="text-muted-foreground mt-4 max-w-xl">Setiap jersey diverifikasi keasliannya. Telusuri katalog lengkap original, vintage, retro, dan koleksi limited edition.</p>
            </div>
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 self-end">
              <Input placeholder="Cari klub, pemain, tahun..." value={q} onChange={(e) => setQ(e.target.value)} />
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="best">Terlaris</SelectItem>
                  <SelectItem value="price_low">Harga Terendah</SelectItem>
                  <SelectItem value="price_high">Harga Tertinggi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-10">
            <aside className="space-y-2">
              <div className="eyebrow text-muted-foreground mb-3">Kategori</div>
              <button onClick={() => setCategory("all")} className={`block w-full text-left text-sm py-2 border-l-2 pl-3 cursor-pointer ${category === "all" ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>Semua</button>
              {cats.data?.map((c) => (
                <button key={c.id} onClick={() => setCategory(c.slug)} className={`block w-full text-left text-sm py-2 border-l-2 pl-3 cursor-pointer ${category === c.slug ? "border-primary font-semibold" : "border-transparent text-muted-foreground"}`}>{c.name}</button>
              ))}
            </aside>

            <div>
              {empty ? (
                <div className="border border-dashed border-border p-16 text-center">
                  <h3 className="display-md">Belum ada produk</h3>
                  <p className="text-muted-foreground mt-3">Katalog masih kosong. <Link to="/admin/produk" className="underline">Admin dapat menambahkan produk →</Link></p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  {list.map((p) => <ProductCard key={p.id} p={p} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>
      <Footer />
    </>
  );
}
