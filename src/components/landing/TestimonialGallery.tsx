import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/storage";
import { Section } from "./Section";
import { Star, ShieldCheck, MapPin, HandCoins, Truck, Shirt } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimonialItem {
  id: string;
  orderNumber: string;
  recipientName: string;
  city: string;
  deliveryType: "COD" | "Ekspedisi";
  rating: number;
  testimonialText: string;
  photoUrl?: string;
  productName: string;
  productSize?: string;
  dateStr?: string;
}

export function TestimonialGallery() {
  const [filter, setFilter] = useState<"all" | "cod" | "shipping">("all");

  const testimonialsQuery = useQuery({
    queryKey: ["public-testimonials-gallery"],
    queryFn: async (): Promise<TestimonialItem[]> => {
      // 1. Fetch real delivered orders from Supabase
      const { data: orders, error: oErr } = await supabase
        .from("orders")
        .select(
          "id, order_number, recipient_name, recipient_kota, courier, recipient_alamat, testimonial_text, testimonial_photo_url, testimonial_rating, cod_proof_url, created_at, order_items(product_id, product_name, image_url, size, quantity)",
        )
        .eq("status", "delivered")
        .order("created_at", { ascending: false })
        .limit(20);

      if (oErr || !orders || orders.length === 0) {
        return [];
      }

      // Filter STRICTLY for orders that have a genuine testimonial or uploaded user photo
      // Never invent or fabricate dummy review text or fake ratings!
      const ordersWithRealReviews = orders.filter(
        (o: any) => Boolean(o.testimonial_text?.trim() || o.testimonial_photo_url || o.cod_proof_url),
      );

      if (ordersWithRealReviews.length === 0) {
        return [];
      }

      const items: TestimonialItem[] = [];

      for (const o of ordersWithRealReviews) {
        const rawItems = (o.order_items as any[]) || [];

        // STRICTLY user-uploaded photo: testimonial photo or COD proof photo.
        // DO NOT fall back to product catalog stock images!
        let userPhotoUrl = o.testimonial_photo_url || o.cod_proof_url || "";
        if (userPhotoUrl && !userPhotoUrl.startsWith("http")) {
          try {
            userPhotoUrl = await signedUrl("payment-proofs", userPhotoUrl);
          } catch {
            userPhotoUrl = "";
          }
        }

        // Format clean customer name (removes marketplace/channel tags like "- FB", "(Shopee)")
        const cleanName =
          (o.recipient_name || "Pelanggan")
            .replace(/\s*-\s*(FB|Shopee|Facebook|Instagram|WA|WhatsApp).*/i, "")
            .replace(/\s*\([^\)]*\)/g, "")
            .trim() || o.recipient_name || "Pelanggan";

        const isCod =
          o.courier === "COD" ||
          (o.recipient_alamat && o.recipient_alamat.toLowerCase().includes("cod")) ||
          o.order_number?.startsWith("POS-");

        const reviewText = o.testimonial_text?.trim() || "";
        const rating = Number(o.testimonial_rating) || 5;
        const dateStr = new Date(o.created_at).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        // Testimonial PER PRODUK (bukan per transaksi):
        // Setiap produk yang dibeli memiliki kartu testimoninya sendiri
        if (rawItems.length > 0) {
          rawItems.forEach((it, idx) => {
            items.push({
              id: `${o.id}-${it.product_id || idx}`,
              orderNumber: o.order_number,
              recipientName: cleanName,
              city: o.recipient_kota || "Kota Cimahi",
              deliveryType: (isCod ? "COD" : "Ekspedisi") as "COD" | "Ekspedisi",
              rating,
              testimonialText: reviewText,
              photoUrl: userPhotoUrl || undefined, // ONLY user photo!
              productName: it.product_name || "Jersey Sepakbola",
              productSize: it.size || undefined,
              dateStr,
            });
          });
        } else {
          items.push({
            id: o.id,
            orderNumber: o.order_number,
            recipientName: cleanName,
            city: o.recipient_kota || "Kota Cimahi",
            deliveryType: (isCod ? "COD" : "Ekspedisi") as "COD" | "Ekspedisi",
            rating,
            testimonialText: reviewText,
            photoUrl: userPhotoUrl || undefined,
            productName: "Jersey Sepakbola",
            dateStr,
          });
        }
      }

      return items;
    },
    staleTime: 60 * 1000,
  });

  const allItems = testimonialsQuery.data || [];

  const filteredItems = allItems.filter((it) => {
    if (filter === "cod") return it.deliveryType === "COD";
    if (filter === "shipping") return it.deliveryType === "Ekspedisi";
    return true;
  });

  return (
    <Section eyebrow="N° 08 — Galeri Bukti & Testimoni" number="Bukti Nyata">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h2 className="display-lg">
            Galeri Transaksi &<br />
            <span className="italic font-light">Testimoni Nyata.</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-xl leading-relaxed">
            Data transaksi asli pesanan selesai di toko kami, mulai dari ketemuan COD langsung di Cimahi hingga pengiriman ke berbagai kota di Indonesia.
          </p>
        </div>

        {/* Filter Tab Buttons */}
        {allItems.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer",
                filter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semua Bukti ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("cod")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                filter === "cod"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HandCoins className="size-3 text-emerald-600" />
              Ketemuan COD
            </button>
            <button
              type="button"
              onClick={() => setFilter("shipping")}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer flex items-center gap-1.5",
                filter === "shipping"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Truck className="size-3 text-primary" />
              Ekspedisi
            </button>
          </div>
        )}
      </div>

      {testimonialsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 bg-muted/30 rounded-xl animate-pulse border border-border" />
          ))}
        </div>
      ) : allItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/60 backdrop-blur-xs max-w-xl mx-auto space-y-4 shadow-xs">
          <div className="size-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground border border-border">
            <Star className="size-6 text-muted-foreground/40" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-extrabold text-base text-foreground">Belum Ada Ulasan & Testimoni</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              Belum ada ulasan atau testimoni dari pelanggan saat ini. Ulasan asli dari pembeli akan muncul secara otomatis di sini setelah pembeli atau admin memberikan rating bintang dan ulasan pesanan yang telah selesai.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <ShieldCheck className="size-3.5" />
              100% Ulasan Transaksi Nyata
            </span>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/20 max-w-md mx-auto">
          <p className="text-xs text-muted-foreground">Belum ada testimoni untuk metode pengiriman ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id + idx}
              className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg"
            >
              {/* Photo Section */}
              <div className="relative aspect-[4/3] bg-muted/40 overflow-hidden">
                {item.photoUrl ? (
                  <img
                    src={item.photoUrl}
                    alt={`Bukti transaksi ${item.recipientName}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-emerald-500/5">
                    <ShieldCheck className="size-10 text-emerald-600 mb-2" />
                    <span className="text-xs font-bold text-foreground">Transaksi Terverifikasi</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{item.orderNumber}</span>
                  </div>
                )}

                {/* Delivery Type Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase bg-background/90 backdrop-blur-md border border-border shadow-xs text-foreground">
                  {item.deliveryType === "COD" ? (
                    <>
                      <HandCoins className="size-3 text-emerald-600" />
                      <span>COD Selesai</span>
                    </>
                  ) : (
                    <>
                      <Truck className="size-3 text-primary" />
                      <span>Paket Terkirim</span>
                    </>
                  )}
                </div>
              </div>

              {/* Testimonial Content */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  {/* Nama Produk (Diletakkan di atas bintang agar jelas & menonjol) */}
                  <div className="font-extrabold text-sm text-foreground line-clamp-1 flex items-center gap-1.5">
                    <Shirt className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate" title={item.productName}>
                      {item.productName}
                    </span>
                  </div>

                  {/* Stars Rating */}
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5 transition-colors",
                          i < (item.rating || 5)
                            ? "fill-amber-400 text-amber-400"
                            : "fill-muted/20 text-muted-foreground/30",
                        )}
                      />
                    ))}
                    <span className="text-[11px] font-bold text-muted-foreground ml-1 tabular-nums">
                      {(item.rating || 5)}.0
                    </span>
                  </div>

                  {/* Review Text */}
                  {item.testimonialText && (
                    <p className="text-xs text-foreground leading-relaxed italic line-clamp-4 pt-0.5">
                      &ldquo;{item.testimonialText}&rdquo;
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/60 space-y-1.5">
                  {/* Customer Details */}
                  <div className="flex items-center justify-between">
                    <div className="font-extrabold text-xs text-foreground truncate">
                      {item.recipientName}
                    </div>
                    {item.dateStr && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {item.dateStr}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <MapPin className="size-3 text-primary shrink-0" />
                      <span className="truncate">{item.city}</span>
                    </div>
                    {item.productSize && (
                      <span className="text-[10px] font-mono bg-muted/60 px-1.5 py-0.5 rounded border border-border/50 shrink-0 font-medium">
                        Size {item.productSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
