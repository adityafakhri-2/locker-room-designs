import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Section } from "@/components/landing/Section";
import { ProductCard } from "@/components/commerce/ProductCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — AA Jersey" },
      {
        name: "description",
        content: "Katalog jersey original, vintage, retro, dan limited edition di AA Jersey.",
      },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    category?: string;
    sort?: string;
    q?: string;
    page?: number;
  } => ({
    category: (search.category as string) || "all",
    sort: (search.sort as string) || "newest",
    q: (search.q as string) || "",
    page: Number(search.page) || 1,
  }),
  component: ShopPage,
});

const ITEMS_PER_PAGE = 12;

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

function ShopPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const category = search.category || "all";
  const sort = search.sort || "newest";
  const q = search.q || "";
  const page = search.page || 1;

  const setCategory = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, category: val, page: 1 }) });
  const setSort = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, sort: val, page: 1 }) });
  const setQ = (val: string) => navigate({ search: (prev) => ({ ...prev, q: val, page: 1 }) });
  const setPage = (val: number) => navigate({ search: (prev) => ({ ...prev, page: val }) });

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
    staleTime: 1000 * 15,
  });

  const activeCategoryObject = useMemo(() => {
    return cats.data?.find((c) => c.slug === category || c.id === category);
  }, [category, cats.data]);

  const activeCategoryId = activeCategoryObject?.id || "all";

  const products = useQuery({
    queryKey: ["products", activeCategoryId, sort, q, page],
    queryFn: async () => {
      let qy = supabase
        .from("products")
        .select(
          "id, slug, name, price, cover_image_url, team, release_year, authenticity_badge, sold_count",
          { count: "exact" },
        )
        .eq("is_active", true);

      if (activeCategoryId !== "all") qy = qy.contains("category_ids", [activeCategoryId]);
      if (q) qy = qy.ilike("name", `%${q}%`);

      if (sort === "price_low") qy = qy.order("price", { ascending: true });
      else if (sort === "price_high") qy = qy.order("price", { ascending: false });
      else if (sort === "best") qy = qy.order("sold_count", { ascending: false });
      else qy = qy.order("created_at", { ascending: false });

      // Range for pagination
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      qy = qy.range(from, to);

      const { data, count, error } = await qy;
      if (error) throw error;

      return {
        items: data ?? [],
        total: count ?? 0,
      };
    },
    staleTime: 1000 * 10,
  });

  const list = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const empty = !products.isLoading && list.length === 0;
  const heading = useMemo(
    () => activeCategoryObject?.name ?? "Semua Jersey",
    [activeCategoryObject],
  );

  return (
    <>
      <Navbar />
      <main id="main-content">
        <Section bare className="pt-28 md:pt-36 pb-20 md:pb-28">
          <div className="container-swiss">
            <div className="grid lg:grid-cols-12 gap-10 mb-12">
              <div className="lg:col-span-7">
                <span className="eyebrow text-muted-foreground">N° 01 — Catalog</span>
                <h1 className="display-lg mt-3">{heading}</h1>
                <p className="text-muted-foreground mt-4 max-w-xl">
                  Setiap jersey diverifikasi keasliannya. Telusuri katalog lengkap original,
                  vintage, retro, dan koleksi limited edition.
                </p>
              </div>
              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-3 self-end">
                <Input
                  placeholder="Cari klub, pemain, tahun..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <aside className="min-w-0 w-full lg:space-y-2">
                <div className="eyebrow text-muted-foreground mb-3 hidden lg:block">Kategori</div>
                <nav className="flex lg:flex-col gap-1.5 overflow-x-auto w-full -mx-5 px-5 lg:mx-0 lg:px-0 scrollbar-none pb-3 lg:pb-0">
                  <button
                    onClick={() => setCategory("all")}
                    className={cn(
                      "px-4 py-2.5 lg:px-3 lg:py-2 text-sm border-b-2 lg:border-b-0 lg:border-l-2 cursor-pointer whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-primary",
                      category === "all"
                        ? "border-primary font-semibold text-foreground bg-accent/20 lg:bg-transparent"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Semua
                  </button>
                  {cats.data?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCategory(c.slug)}
                      className={cn(
                        "px-4 py-2.5 lg:px-3 lg:py-2 text-sm border-b-2 lg:border-b-0 lg:border-l-2 cursor-pointer whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-primary",
                        category === c.slug
                          ? "border-primary font-semibold text-foreground bg-accent/20 lg:bg-transparent"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </nav>
              </aside>

              <div>
                {products.isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : empty ? (
                  <div className="border border-dashed border-border p-16 text-center">
                    <h3 className="display-md">Belum ada produk</h3>
                    <p className="text-muted-foreground mt-3">
                      Katalog masih kosong.{" "}
                      <Link to="/admin/produk" className="underline">
                        Admin dapat menambahkan produk →
                      </Link>
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
                      {list.map((p) => (
                        <ProductCard key={p.id} p={p} />
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <nav
                        className="mt-12 flex justify-center items-center gap-4"
                        aria-label="Navigasi Halaman"
                      >
                        <button
                          disabled={page <= 1}
                          onClick={() => setPage(page - 1)}
                          className="px-4 py-2 border text-sm font-medium hover:border-foreground disabled:opacity-30 disabled:hover:border-border transition-all cursor-pointer"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold mx-2">
                          Halaman {page} dari {totalPages}
                        </span>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage(page + 1)}
                          className="px-4 py-2 border text-sm font-medium hover:border-foreground disabled:opacity-30 disabled:hover:border-border transition-all cursor-pointer"
                        >
                          Berikutnya
                        </button>
                      </nav>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
