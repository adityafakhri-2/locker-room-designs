import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTrustStats, type PublicTrustStatsData } from "@/lib/api/stats.functions";
import { Section } from "./Section";

function formatStatNumber(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function TrustStats() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["public-trust-stats"],
    queryFn: async (): Promise<PublicTrustStatsData> => {
      // 1. Utamakan server function yang membaca seluruh data akurat via service role
      try {
        const serverStats = await getPublicTrustStats();
        if (serverStats && (serverStats.totalJerseysSold > 0 || serverStats.totalCustomers > 0)) {
          return serverStats;
        }
      } catch {
        // Lanjut ke fallback client query jika server function gagal
      }

      // 2. Fallback client-side query dari tabel publik & RPC
      const [productsRes, testimonialsRes, ordersRes, rolesRes] = await Promise.all([
        supabase.from("products").select("id, sold_count, is_active"),
        supabase.rpc("get_public_testimonials", { limit_count: 100 }),
        supabase
          .from("orders")
          .select("id, user_id, recipient_name, recipient_no_hp, status, testimonial_rating, order_items(quantity)"),
        supabase.from("user_roles").select("user_id").eq("role", "customer"),
      ]);

      const products = productsRes.data ?? [];
      const soldFromProducts = products.reduce((sum, p) => sum + (Number(p.sold_count) || 0), 0);
      const activeProductsCount = products.filter((p) => p.is_active).length;

      const orders = ordersRes.data ?? [];
      const validOrders = orders.filter((o: any) =>
        ["paid", "processing", "shipped", "delivered"].includes(o.status),
      );
      const soldFromOrders = validOrders.reduce((sum: number, o: any) => {
        const items = Array.isArray(o.order_items) ? o.order_items : [];
        return sum + items.reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0);
      }, 0);

      const totalJerseysSold = Math.max(soldFromProducts, soldFromOrders);

      // Hitung pelanggan unik dari data yang tersedia
      const registeredIds = new Set((rolesRes.data ?? []).map((r: any) => r.user_id));
      const uniqueBuyers = new Set<string>();
      validOrders.forEach((o: any) => {
        if (!o.user_id || !registeredIds.has(o.user_id)) {
          const nameKey = `${(o.recipient_name || "").toLowerCase().trim()}___${(o.recipient_no_hp || "").trim()}`;
          uniqueBuyers.add(nameKey);
        }
      });

      const testimonials = (testimonialsRes.data as any[]) ?? [];
      testimonials.forEach((t) => {
        if (t.recipient_name) {
          uniqueBuyers.add(`${t.recipient_name.toLowerCase().trim()}___${t.recipient_kota || ""}`);
        }
      });

      const totalCustomers = Math.max(
        registeredIds.size + uniqueBuyers.size,
        testimonials.length,
      );

      const ratings: number[] = [];
      testimonials.forEach((t) => {
        const r = Number(t.testimonial_rating);
        if (r >= 1 && r <= 5) ratings.push(r);
      });

      const totalReviews = ratings.length;
      const averageRating =
        totalReviews > 0
          ? Number((ratings.reduce((a, b) => a + b, 0) / totalReviews).toFixed(1))
          : 5.0;
      const satisfiedCount = ratings.filter((r) => r >= 4).length;
      const satisfactionRate =
        totalReviews > 0 ? Math.round((satisfiedCount / totalReviews) * 100) : 100;

      return {
        totalCustomers,
        totalJerseysSold,
        averageRating,
        totalReviews,
        satisfactionRate,
        activeProductsCount,
      };
    },
    staleTime: 60 * 1000,
  });

  const items = [
    {
      value: isLoading ? "—" : formatStatNumber(stats?.totalCustomers ?? 0),
      label: "Penggemar Sepak Bola",
    },
    {
      value: isLoading ? "—" : formatStatNumber(stats?.totalJerseysSold ?? 0),
      label: "Jersey Terkirim",
    },
    {
      value: isLoading ? "—" : `${(stats?.averageRating ?? 5.0).toFixed(1)}/5`,
      label: "Penilaian Pembeli",
    },
    {
      value: isLoading ? "—" : `${stats?.satisfactionRate ?? 100}%`,
      label: "Jaminan Kualitas",
    },
  ];

  const isThousands = (stats?.totalCustomers ?? 0) >= 1000;

  return (
    <Section eyebrow="N° 02 — Kepercayaan" number="Bukti Nyata">
      <div className="grid lg:grid-cols-12 gap-10">
        <h2 className="lg:col-span-5 display-lg">
          {isThousands ? "Dipercaya oleh ribuan" : "Dipercaya oleh para"}
          <br />
          <span className="italic font-light">pecinta sepak bola.</span>
        </h2>
        <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
          {items.map((s) => (
            <div key={s.label} className="bg-background p-6 md:p-8 flex flex-col gap-2">
              <span className="display-md tabular-nums">{s.value}</span>
              <span className="eyebrow text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
