import { createFileRoute, Link, useParams, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, ShieldCheck, Star, Shirt, Gem, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { formatIDR } from "@/lib/format";
import { useAddToCart, useToggleWishlist, useWishlist } from "@/hooks/use-commerce";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/product/$slug")({
  component: ProductDetail,
});

const BADGE_MAP: Record<string, { label: string; icon: any }> = {
  original_verified: { label: "Original Terverifikasi", icon: ShieldCheck },
  match_worn: { label: "Jersey Pertandingan (Match Worn)", icon: Shirt },
  collector_item: { label: "Barang Koleksi (Collector Item)", icon: Gem },
  limited_edition: { label: "Edisi Terbatas (Limited Edition)", icon: Sparkles }
};

function ProductDetail() {
  const navigate = useNavigate();
  const { slug } = useParams({ from: "/product/$slug" });
  const { user } = useAuth();
  const [size, setSize] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);

  const q = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*), product_certificates(*), categories(name, slug)")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const reviewsQ = useQuery({
    queryKey: ["reviews", q.data?.id],
    enabled: !!q.data?.id,
    queryFn: async () => (await supabase.from("reviews").select("*").eq("product_id", q.data!.id).eq("approved", true).eq("hidden", false).order("created_at", { ascending: false })).data ?? [],
  });

  const related = useQuery({
    queryKey: ["related", q.data?.category_ids, q.data?.id],
    enabled: !!q.data?.category_ids && q.data.category_ids.length > 0,
    queryFn: async () => (await supabase.from("products").select("*").overlaps("category_ids", q.data!.category_ids).neq("id", q.data!.id).eq("is_active", true).limit(4)).data ?? [],
  });

  const addToCart = useAddToCart();
  const { data: wl } = useWishlist();
  const toggleWl = useToggleWishlist();
  const liked = !!wl?.some((w) => w.product_id === q.data?.id);

  if (q.isLoading) {
    return (<><Navbar /><div className="min-h-screen pt-32 container-swiss">Memuat...</div></>);
  }
  if (!q.data) {
    return (<><Navbar /><div className="min-h-screen pt-32 container-swiss">Produk tidak ditemukan.</div></>);
  }
  const p = q.data;
  const images = (p.product_images ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const allImages = [p.cover_image_url, ...images.map((i) => i.url)].filter(Boolean) as string[];
  const cert = p.product_certificates?.[0];
  const avgRating = reviewsQ.data?.length ? (reviewsQ.data.reduce((s, r) => s + r.rating, 0) / reviewsQ.data.length) : 0;

  const sizeStockMap = (p as any).size_stock as Record<string, number> | null ?? {};
  const isSizeOutOfStock = (s: string) => {
    if (s in sizeStockMap) {
      return sizeStockMap[s] <= 0;
    }
    return p.stock <= 0;
  };
  const selectedSizeStock = size ? (sizeStockMap[size] ?? p.stock) : p.stock;
  const isOutOfStock = p.stock <= 0 || (size ? selectedSizeStock <= 0 : false);

  return (
    <>
      <Navbar />
      <div className="pt-24 md:pt-28 pb-20 container-swiss">
        <div className="text-xs text-muted-foreground mb-6 flex gap-2">
          <Link to="/" className="hover:underline">Home</Link><span>/</span>
          <Link to="/shop" className="hover:underline">Shop</Link>
          {p.categories && (<><span>/</span><span>{p.categories.name}</span></>)}
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <div className="aspect-[4/5] bg-muted overflow-hidden">
              {allImages[activeImg] ? <img src={allImages[activeImg]} alt={p.name} className="size-full object-cover" /> : <div className="size-full grid place-items-center text-muted-foreground">No image</div>}
            </div>
            {allImages.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {allImages.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={cn("aspect-square overflow-hidden bg-muted border", i === activeImg ? "border-primary" : "border-transparent")}>
                    <img src={src} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            {p.authenticity_badge && (() => {
              const badge = BADGE_MAP[p.authenticity_badge];
              if (!badge) return null;
              const Icon = badge.icon;
              return (
                <span className="inline-flex items-center gap-2 eyebrow text-primary mb-4">
                  <Icon className="size-4" /> {badge.label}
                </span>
              );
            })()}
            <h1 className="display-md">{p.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">{[p.team, p.league, p.release_year].filter(Boolean).join(" · ")}</p>

            <div className="mt-6 flex items-baseline gap-4">
              <span className="text-3xl font-extrabold">{formatIDR(p.price)}</span>
              <span className="text-xs text-muted-foreground">Stok: {p.stock}</span>
            </div>

            {reviewsQ.data && reviewsQ.data.length > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <Star className="size-4 fill-primary text-primary" />
                <span className="font-semibold">{avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">({reviewsQ.data.length} ulasan)</span>
              </div>
            )}

            {p.sizes && p.sizes.length > 0 && (
              <div className="mt-8">
                <div className="eyebrow text-muted-foreground mb-3">Ukuran</div>
                <div className="flex flex-wrap gap-2">
                  {p.sizes.map((s) => {
                    const outOfStock = isSizeOutOfStock(s);
                    return (
                      <button
                        key={s}
                        disabled={outOfStock}
                        onClick={() => setSize(s)}
                        className={cn(
                          "min-w-14 h-11 px-4 border text-sm font-medium transition-all",
                          outOfStock
                            ? "border-border text-muted-foreground/40 line-through cursor-not-allowed bg-muted/20"
                            : size === s
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-foreground"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="mt-8 flex gap-3">
              <Button
                className="flex-1 h-12"
                disabled={isOutOfStock || addToCart.isPending}
                onClick={() => {
                  if (!user) {
                    toast.error("Silakan masuk terlebih dahulu");
                    navigate({ to: "/auth" });
                    return;
                  }
                  if (p.sizes && p.sizes.length > 0 && !size) { toast.error("Pilih ukuran"); return; }
                  addToCart.mutate({ product_id: p.id, size }, { onSuccess: () => toast.success("Ditambahkan ke keranjang") });
                }}
              >
                {p.stock <= 0 ? "Stok Habis" : size && selectedSizeStock <= 0 ? "Stok Ukuran Habis" : "Tambah ke Keranjang"}
              </Button>
              <Button variant="outline" className="h-12" onClick={() => {
                if (!user) {
                  toast.error("Silakan masuk terlebih dahulu");
                  navigate({ to: "/auth" });
                  return;
                }
                toggleWl.mutate(p.id);
              }}>
                <Heart className={cn("size-4", liked && "fill-primary text-primary")} />
              </Button>
            </div>

            <Accordion type="multiple" defaultValue={["desc", "story"]} className="mt-10">
              <AccordionItem value="desc">
                <AccordionTrigger>Deskripsi</AccordionTrigger>
                <AccordionContent><div className="text-sm text-muted-foreground whitespace-pre-line">{p.description || "—"}</div></AccordionContent>
              </AccordionItem>
              {p.story && (
                <AccordionItem value="story">
                  <AccordionTrigger>Story</AccordionTrigger>
                  <AccordionContent><div className="text-sm text-muted-foreground whitespace-pre-line italic">{p.story}</div></AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="spec">
                <AccordionTrigger>Spesifikasi</AccordionTrigger>
                <AccordionContent>
                  <dl className="text-sm grid grid-cols-2 gap-y-2">
                    {[["Brand", p.brand], ["Tim", p.team], ["Liga", p.league], ["Negara", p.country], ["Tahun", p.release_year], ["Kondisi", p.condition], ["Collector Score", "★".repeat(p.collector_score)]].map(([k, v]) => (
                      <div key={k as string} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v ?? "—"}</dd></div>
                    ))}
                  </dl>
                </AccordionContent>
              </AccordionItem>
              {cert && (
                <AccordionItem value="cert">
                  <AccordionTrigger>Certificate of Authenticity</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm"><strong>No:</strong> {cert.certificate_number}</p>
                    {cert.notes && <p className="text-sm text-muted-foreground mt-2">{cert.notes}</p>}
                    {cert.proof_image_url && <img src={cert.proof_image_url} alt="Certificate" className="mt-3 max-w-xs border border-border" />}
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        </div>

        {reviewsQ.data && reviewsQ.data.length > 0 && (
          <section className="mt-20 border-t border-border pt-12">
            <h2 className="display-md">Ulasan Pembeli</h2>
            <div className="mt-8 grid md:grid-cols-2 gap-6">
              {reviewsQ.data.map((r) => (
                <div key={r.id} className="border border-border p-6">
                  <div className="flex items-center gap-1 text-primary mb-2">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-current" />)}
                  </div>
                  <p className="text-sm">{r.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {related.data && related.data.length > 0 && (
          <section className="mt-20 border-t border-border pt-12">
            <h2 className="display-md mb-8">Produk Terkait</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {related.data.map((rp) => (
                <Link key={rp.id} to="/product/$slug" params={{ slug: rp.slug }} className="group">
                  <div className="aspect-[4/5] bg-muted overflow-hidden">
                    {rp.cover_image_url && <img src={rp.cover_image_url} alt={rp.name} className="size-full object-cover transition-transform group-hover:scale-105" />}
                  </div>
                  <div className="pt-3 text-sm font-semibold truncate">{rp.name}</div>
                  <div className="text-sm text-muted-foreground">{formatIDR(rp.price)}</div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </>
  );
}
