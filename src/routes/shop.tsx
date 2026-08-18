import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Filter,
  RotateCcw,
  X,
  SlidersHorizontal,
  Shirt,
  ShieldCheck,
  Check,
  Search,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Katalog & Filter Produk — AA Jersey" },
      {
        name: "description",
        content:
          "Filter lengkap jersey sepak bola: Home, Away, Third, Club, Liga, Brand, Ukuran, Original & Grade Ori Import Thailand 1:1.",
      },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    category?: string;
    edition?: string;
    quality?: string;
    team?: string;
    league?: string;
    brand?: string;
    size?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: string;
    q?: string;
    page?: number;
  } => ({
    category: (search.category as string) || "all",
    edition: (search.edition as string) || "all",
    quality: (search.quality as string) || "all",
    team: (search.team as string) || "all",
    league: (search.league as string) || "all",
    brand: (search.brand as string) || "all",
    size: (search.size as string) || "all",
    minPrice: search.minPrice ? Number(search.minPrice) : undefined,
    maxPrice: search.maxPrice ? Number(search.maxPrice) : undefined,
    sort: (search.sort as string) || "newest",
    q: (search.q as string) || "",
    page: Number(search.page) || 1,
  }),
  component: ShopPage,
});

const ITEMS_PER_PAGE = 12;

const EDITIONS = [
  { value: "all", label: "Semua Tipe" },
  { value: "home", label: "Home" },
  { value: "away", label: "Away" },
  { value: "third", label: "Third" },
  { value: "gk", label: "Kiper (GK)" },
  { value: "retro", label: "Retro / Classic" },
];

const QUALITIES = [
  { value: "all", label: "Semua Kualitas" },
  { value: "grade_ori", label: "Grade Ori Import 1:1" },
  { value: "original_verified", label: "Original Resmi 100%" },
];

const ALL_SIZES = ["S", "M", "L", "XL", "XXL"];

const PRICE_PRESETS = [
  { label: "< Rp 100rb", min: undefined, max: 100000 },
  { label: "Rp 100rb - 150rb", min: 100000, max: 150000 },
  { label: "Rp 150rb - 200rb", min: 150000, max: 200000 },
  { label: "> Rp 200rb", min: 200000, max: undefined },
];

function ProductCardSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="relative aspect-[4/5] bg-muted w-full rounded-lg" />
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
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const category = search.category || "all";
  const edition = search.edition || "all";
  const quality = search.quality || "all";
  const team = search.team || "all";
  const league = search.league || "all";
  const brand = search.brand || "all";
  const size = search.size || "all";
  const minPrice = search.minPrice;
  const maxPrice = search.maxPrice;
  const sort = search.sort || "newest";
  const q = search.q || "";
  const page = search.page || 1;

  const updateSearch = (updater: (prev: typeof search) => Partial<typeof search>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updater(prev),
        page: 1, // Reset page when filter changes
      }),
    });
  };

  const setCategory = (val: string) => updateSearch(() => ({ category: val }));
  const setEdition = (val: string) => updateSearch(() => ({ edition: val }));
  const setQuality = (val: string) => updateSearch(() => ({ quality: val }));
  const setTeam = (val: string) => updateSearch(() => ({ team: val }));
  const setLeague = (val: string) => updateSearch(() => ({ league: val }));
  const setBrand = (val: string) => updateSearch(() => ({ brand: val }));
  const setSize = (val: string) => updateSearch(() => ({ size: val }));
  const setPriceRange = (min?: number, max?: number) =>
    updateSearch(() => ({ minPrice: min, maxPrice: max }));
  const setSort = (val: string) => updateSearch(() => ({ sort: val }));
  const setQ = (val: string) => updateSearch(() => ({ q: val }));
  const setPage = (val: number) => navigate({ search: (prev) => ({ ...prev, page: val }) });

  const selectedEditions = useMemo(() => {
    if (!edition || edition === "all") return [];
    return edition.split(",").map((s) => s.trim()).filter(Boolean);
  }, [edition]);

  const toggleEdition = (val: string) => {
    if (val === "all") {
      setEdition("all");
      return;
    }
    let next: string[];
    if (selectedEditions.includes(val)) {
      next = selectedEditions.filter((e) => e !== val);
    } else {
      next = [...selectedEditions, val];
    }
    setEdition(next.length === 0 ? "all" : next.join(","));
  };

  const resetAllFilters = () => {
    navigate({
      search: () => ({
        category: "all",
        edition: "all",
        quality: "all",
        team: "all",
        league: "all",
        brand: "all",
        size: "all",
        minPrice: undefined,
        maxPrice: undefined,
        sort: "newest",
        q: "",
        page: 1,
      }),
    });
  };

  // Fetch Categories
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
    staleTime: 1000 * 30,
  });

  // Fetch Distinct Filter Metadata from Products
  const filterMeta = useQuery({
    queryKey: ["shop-filter-metadata"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("brand, league, team, sizes")
        .eq("is_active", true);

      const bSet = new Set<string>();
      const lSet = new Set<string>();
      const tSet = new Set<string>();

      (data ?? []).forEach((p) => {
        if (p.brand) bSet.add(p.brand);
        if (p.league) lSet.add(p.league);
        if (p.team) tSet.add(p.team);
      });

      return {
        brands: Array.from(bSet).sort(),
        leagues: Array.from(lSet).sort(),
        teams: Array.from(tSet).sort(),
      };
    },
    staleTime: 1000 * 30,
  });

  const activeCategoryObject = useMemo(() => {
    return cats.data?.find((c) => c.slug === category || c.id === category);
  }, [category, cats.data]);

  const activeCategoryId = activeCategoryObject?.id || "all";

  // Calculate active filter count (excluding default page / sort)
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (category !== "all") count++;
    if (selectedEditions.length > 0) count += selectedEditions.length;
    if (quality !== "all") count++;
    if (team !== "all") count++;
    if (league !== "all") count++;
    if (brand !== "all") count++;
    if (size !== "all") count++;
    if (minPrice !== undefined || maxPrice !== undefined) count++;
    if (q.trim()) count++;
    return count;
  }, [category, selectedEditions, quality, team, league, brand, size, minPrice, maxPrice, q]);

  // Main Products Query with Multi-Filters
  const products = useQuery({
    queryKey: [
      "products",
      activeCategoryId,
      edition,
      quality,
      team,
      league,
      brand,
      size,
      minPrice,
      maxPrice,
      sort,
      q,
      page,
    ],
    queryFn: async () => {
      let qy = supabase
        .from("products")
        .select(
          "id, slug, name, price, original_price, cover_image_url, team, release_year, authenticity_badge, sold_count, brand, league, sizes, stock",
          { count: "exact" },
        )
        .eq("is_active", true);

      // Category filter
      if (activeCategoryId !== "all") {
        qy = qy.contains("category_ids", [activeCategoryId]);
      }

      // Quality (Authenticity)
      if (quality !== "all") {
        qy = qy.eq("authenticity_badge", quality as any);
      }

      // Team / Club
      if (team !== "all") {
        qy = qy.eq("team", team);
      }

      // League
      if (league !== "all") {
        qy = qy.eq("league", league);
      }

      // Brand
      if (brand !== "all") {
        qy = qy.eq("brand", brand);
      }

      // Size
      if (size !== "all") {
        qy = qy.contains("sizes", [size]);
      }

      // Price Range
      if (minPrice !== undefined) {
        qy = qy.gte("price", minPrice);
      }
      if (maxPrice !== undefined) {
        qy = qy.lte("price", maxPrice);
      }

      // Multi-Select Edition / Kit Type (Home / Away / Third / GK / Retro)
      if (selectedEditions.length > 0) {
        const editionFilters: string[] = [];
        selectedEditions.forEach((ed) => {
          if (ed === "home") editionFilters.push("name.ilike.%home%");
          if (ed === "away") editionFilters.push("name.ilike.%away%");
          if (ed === "third") editionFilters.push("name.ilike.%third%");
          if (ed === "gk") {
            editionFilters.push("name.ilike.%gk%");
            editionFilters.push("name.ilike.%goalkeeper%");
            editionFilters.push("name.ilike.%kiper%");
          }
          if (ed === "retro") {
            editionFilters.push("name.ilike.%retro%");
            editionFilters.push("name.ilike.%classic%");
            editionFilters.push("name.ilike.%vintage%");
            editionFilters.push("name.ilike.%199%");
            editionFilters.push("name.ilike.%200%");
          }
        });
        if (editionFilters.length > 0) {
          qy = qy.or(editionFilters.join(","));
        }
      }

      // Keyword Search
      if (q.trim()) {
        const queryTerm = q.trim();
        qy = qy.or(
          `name.ilike.%${queryTerm}%,team.ilike.%${queryTerm}%,league.ilike.%${queryTerm}%,brand.ilike.%${queryTerm}%`,
        );
      }

      // Sorting
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

      // Sort items so in-stock products appear first, out-of-stock appear at bottom
      const sortedItems = (data ?? []).slice().sort((a, b) => {
        const aInStock = (Number(a.stock) || 0) > 0 ? 1 : 0;
        const bInStock = (Number(b.stock) || 0) > 0 ? 1 : 0;
        return bInStock - aInStock;
      });

      return {
        items: sortedItems,
        total: count ?? 0,
      };
    },
    staleTime: 1000 * 10,
  });

  const list = products.data?.items ?? [];
  const total = products.data?.total ?? 0;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const empty = !products.isLoading && list.length === 0;

  // Filter Sidebar Controls Component (Reused on Desktop & Mobile Drawer)
  const FilterControls = () => (
    <div className="space-y-6 text-sm">
      {/* 1. Tipe Jersey (Home / Away / Third / GK / Retro) - Multi-Select */}
      <div className="space-y-2.5">
        <label className="eyebrow text-xs font-bold text-foreground block">
          Tipe Jersey (Bisa Pilih Banyak)
        </label>
        <div className="flex flex-wrap gap-1.5">
          <button
            key="all"
            type="button"
            onClick={() => toggleEdition("all")}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer border",
              selectedEditions.length === 0
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
            )}
          >
            Semua Tipe
          </button>
          {EDITIONS.filter((e) => e.value !== "all").map((ed) => {
            const active = selectedEditions.includes(ed.value);
            return (
              <button
                key={ed.value}
                type="button"
                onClick={() => toggleEdition(ed.value)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {ed.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Kualitas / Keaslian */}
      <div className="space-y-2.5 pt-4 border-t border-border">
        <label className="eyebrow text-xs font-bold text-foreground block">
          Kualitas Jersey
        </label>
        <div className="space-y-1.5">
          {QUALITIES.map((qItem) => {
            const active = quality === qItem.value;
            return (
              <button
                key={qItem.value}
                type="button"
                onClick={() => setQuality(qItem.value)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-xs font-medium transition-all flex items-center justify-between cursor-pointer border",
                  active
                    ? "bg-primary/10 border-primary text-primary font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <span>{qItem.label}</span>
                {active && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Kategori Utama */}
      <div className="space-y-2.5 pt-4 border-t border-border">
        <label className="eyebrow text-xs font-bold text-foreground block">
          Kategori Utama
        </label>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "w-full text-left px-3 py-2 rounded text-xs transition-all flex items-center justify-between cursor-pointer border",
              category === "all"
                ? "bg-primary/10 border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <span>Semua Kategori</span>
            {category === "all" && <Check className="size-3.5 text-primary" />}
          </button>
          {cats.data?.map((c) => {
            const active = category === c.slug || category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.slug)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded text-xs transition-all flex items-center justify-between cursor-pointer border",
                  active
                    ? "bg-primary/10 border-primary text-primary font-bold"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <span className="truncate">{c.name}</span>
                {active && <Check className="size-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filter Ukuran (Size Chips) */}
      <div className="space-y-2.5 pt-4 border-t border-border">
        <label className="eyebrow text-xs font-bold text-foreground block">
          Pilihan Ukuran
        </label>
        <div className="grid grid-cols-5 gap-1.5">
          {ALL_SIZES.map((sz) => {
            const active = size === sz;
            return (
              <button
                key={sz}
                type="button"
                onClick={() => setSize(active ? "all" : sz)}
                className={cn(
                  "py-2 rounded text-xs font-bold transition-all text-center cursor-pointer border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {sz}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Rentang Harga */}
      <div className="space-y-2.5 pt-4 border-t border-border">
        <label className="eyebrow text-xs font-bold text-foreground block">
          Rentang Harga
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_PRESETS.map((pSet) => {
            const active = minPrice === pSet.min && maxPrice === pSet.max;
            return (
              <button
                key={pSet.label}
                type="button"
                onClick={() => {
                  if (active) setPriceRange(undefined, undefined);
                  else setPriceRange(pSet.min, pSet.max);
                }}
                className={cn(
                  "p-2 rounded text-[11px] font-semibold text-center transition-all cursor-pointer border",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                )}
              >
                {pSet.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Klub / Tim */}
      {filterMeta.data?.teams && filterMeta.data.teams.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <label className="eyebrow text-xs font-bold text-foreground block">
            Klub / Tim
          </label>
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Pilih Klub / Tim" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="all">Semua Klub / Tim</SelectItem>
              {filterMeta.data.teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 7. Liga */}
      {filterMeta.data?.leagues && filterMeta.data.leagues.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <label className="eyebrow text-xs font-bold text-foreground block">
            Kompetisi / Liga
          </label>
          <Select value={league} onValueChange={setLeague}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Pilih Liga" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="all">Semua Liga</SelectItem>
              {filterMeta.data.leagues.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* 8. Brand */}
      {filterMeta.data?.brands && filterMeta.data.brands.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <label className="eyebrow text-xs font-bold text-foreground block">
            Brand Apparel
          </label>
          <Select value={brand} onValueChange={setBrand}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Pilih Brand" />
            </SelectTrigger>
            <SelectContent className="max-h-56">
              <SelectItem value="all">Semua Brand</SelectItem>
              {filterMeta.data.brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Navbar />
      <main id="main-content">
        <Section bare className="pt-28 md:pt-36 pb-20 md:pb-28">
          <div className="container-swiss">
            {/* Header Title & Search Controls */}
            <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 mb-8 items-end">
              <div className="lg:col-span-6">
                <span className="eyebrow text-muted-foreground">N° 01 — Katalog & Filter</span>
                <h1 className="display-lg mt-2">
                  {category !== "all" && activeCategoryObject?.name
                    ? activeCategoryObject.name
                    : "Semua Jersey"}
                </h1>
                <p className="text-muted-foreground mt-3 text-sm md:text-base max-w-xl">
                  Telusuri katalog lengkap jersey sepak bola Grade Ori Thailand kualitas 1:1,
                  jersey retro legendaris, dan jersey original pilihan terbaik.
                </p>
              </div>

              {/* Search & Sort Controls */}
              <div className="lg:col-span-6 flex flex-col sm:flex-row gap-3 items-stretch">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Cari klub, pemain, tahun, jersey..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-9 pr-9 h-10 bg-background text-sm rounded-md border-input focus-visible:ring-1"
                  />
                  {q && (
                    <button
                      onClick={() => setQ("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                <div className="w-full sm:w-48 shrink-0">
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="h-10 bg-background text-sm rounded-md border-input">
                      <SelectValue placeholder="Urutkan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Terbaru</SelectItem>
                      <SelectItem value="best">Terlaris</SelectItem>
                      <SelectItem value="price_low">Harga Terendah</SelectItem>
                      <SelectItem value="price_high">Harga Tertinggi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Mobile Filter Sheet Trigger Button */}
                <div className="lg:hidden">
                  <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full h-10 gap-2 font-semibold border-primary/40 text-primary"
                      >
                        <SlidersHorizontal className="size-4" />
                        <span>Filter Produk</span>
                        {activeFiltersCount > 0 && (
                          <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs grid place-items-center font-bold">
                            {activeFiltersCount}
                          </span>
                        )}
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:w-[360px] overflow-y-auto p-6">
                      <SheetHeader className="mb-4 text-left">
                        <SheetTitle className="flex items-center justify-between">
                          <span className="text-base font-bold">Filter Katalog</span>
                          {activeFiltersCount > 0 && (
                            <button
                              onClick={resetAllFilters}
                              className="text-xs text-primary font-semibold hover:underline"
                            >
                              Reset
                            </button>
                          )}
                        </SheetTitle>
                      </SheetHeader>
                      <FilterControls />
                      <SheetFooter className="mt-6 pt-4 border-t border-border">
                        <Button
                          onClick={() => setMobileFilterOpen(false)}
                          className="w-full"
                        >
                          Lihat {total} Hasil
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>

            {/* Active Filter Chips Bar */}
            {activeFiltersCount > 0 && (
              <div className="flex items-center gap-2 flex-wrap mb-6 pb-4 border-b border-border">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  Filter Aktif:
                </span>

                {category !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Kategori: {activeCategoryObject?.name || category}
                    <button onClick={() => setCategory("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {selectedEditions.map((edVal) => (
                  <Badge key={edVal} variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Tipe: {EDITIONS.find((e) => e.value === edVal)?.label || edVal}
                    <button onClick={() => toggleEdition(edVal)} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}

                {quality !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Kualitas: {QUALITIES.find((q) => q.value === quality)?.label || quality}
                    <button onClick={() => setQuality("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {team !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Klub: {team}
                    <button onClick={() => setTeam("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {league !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Liga: {league}
                    <button onClick={() => setLeague("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {brand !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Brand: {brand}
                    <button onClick={() => setBrand("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {size !== "all" && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Ukuran: {size}
                    <button onClick={() => setSize("all")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {(minPrice !== undefined || maxPrice !== undefined) && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Harga: {minPrice ? formatIDR(minPrice) : "0"} - {maxPrice ? formatIDR(maxPrice) : "Max"}
                    <button onClick={() => setPriceRange(undefined, undefined)} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                {q.trim() && (
                  <Badge variant="secondary" className="gap-1 text-xs py-1 px-2.5">
                    Cari: "{q}"
                    <button onClick={() => setQ("")} className="hover:text-primary cursor-pointer">
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}

                <button
                  onClick={resetAllFilters}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold ml-auto cursor-pointer"
                >
                  Hapus Semua Filter
                </button>
              </div>
            )}

            {/* Layout: Desktop Filter Sidebar (Left) + Product Grid (Right) */}
            <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-10 items-start">
              {/* Desktop Sticky Sidebar */}
              <aside className="hidden lg:block sticky top-28 bg-card/60 border border-border/80 rounded-xl p-5 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
                  <span className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Filter className="size-4 text-primary" />
                    Filter Produk
                  </span>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetAllFilters}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <FilterControls />
              </aside>

              {/* Product Grid Area */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground">
                    Menampilkan <span className="font-bold text-foreground">{list.length}</span> dari{" "}
                    <span className="font-bold text-foreground">{total}</span> jersey
                  </p>
                </div>

                {products.isLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 sm:gap-6 lg:gap-8">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : empty ? (
                  <div className="border border-dashed border-border p-16 text-center rounded-xl bg-muted/20">
                    <Shirt className="size-12 text-muted-foreground/40 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-foreground">Tidak ada jersey yang cocok</h3>
                    <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
                      Coba kurangi filter atau cari dengan kata kunci lain untuk menemukan jersey yang Anda inginkan.
                    </p>
                    {activeFiltersCount > 0 && (
                      <Button onClick={resetAllFilters} variant="outline" className="mt-5 gap-2">
                        <RotateCcw className="size-4" />
                        Reset Semua Filter
                      </Button>
                    )}
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
                          className="px-4 py-2 border border-border text-sm font-semibold rounded hover:border-foreground disabled:opacity-30 disabled:hover:border-border transition-all cursor-pointer"
                        >
                          Sebelumnya
                        </button>
                        <span className="text-sm font-semibold mx-2">
                          Halaman {page} dari {totalPages}
                        </span>
                        <button
                          disabled={page >= totalPages}
                          onClick={() => setPage(page + 1)}
                          className="px-4 py-2 border border-border text-sm font-semibold rounded hover:border-foreground disabled:opacity-30 disabled:hover:border-border transition-all cursor-pointer"
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

