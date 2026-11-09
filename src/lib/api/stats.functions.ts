import { createServerFn } from "@tanstack/react-start";

export interface PublicTrustStatsData {
  totalCustomers: number;
  totalJerseysSold: number;
  averageRating: number;
  totalReviews: number;
  satisfactionRate: number;
  activeProductsCount: number;
}

export const getPublicTrustStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicTrustStatsData> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [rolesRes, ordersRes, productsRes, reviewsRes] = await Promise.all([
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "customer"),
        supabaseAdmin
          .from("orders")
          .select(
            "id, user_id, recipient_name, recipient_no_hp, status, testimonial_rating, testimonial_text, cod_proof_url, testimonial_photo_url, order_items(quantity)",
          ),
        supabaseAdmin.from("products").select("id, sold_count, is_active"),
        supabaseAdmin
          .from("reviews")
          .select("id, rating")
          .eq("approved", true)
          .eq("hidden", false),
      ]);

      const customerRoles = rolesRes.data ?? [];
      const registeredIds = new Set(customerRoles.map((r) => r.user_id));

      const allOrders = ordersRes.data ?? [];
      const validOrders = allOrders.filter((o) =>
        ["paid", "processing", "shipped", "delivered"].includes(o.status),
      );

      // 1. Hitung total pelanggan unik (akun customer terdaftar + pelanggan kasir/manual unik)
      const offlineCustomerKeys = new Set<string>();
      validOrders.forEach((o) => {
        if (!o.user_id || !registeredIds.has(o.user_id)) {
          const cleanName = (o.recipient_name || "pelanggan")
            .toLowerCase()
            .replace(/\s*-\s*(fb|shopee|facebook|instagram|wa|whatsapp).*/i, "")
            .replace(/\s*\([^\)]*\)/g, "")
            .trim();
          const cleanPhone = (o.recipient_no_hp || "").trim();
          const key = `${cleanName}___${cleanPhone}`;
          offlineCustomerKeys.add(key);
        }
      });

      const totalCustomers = registeredIds.size + offlineCustomerKeys.size;

      // 2. Hitung total jersey terkirim/terjual dari order valid & sinkronkan dengan sold_count produk
      const jerseysFromOrders = validOrders.reduce((sum, o) => {
        const items = Array.isArray(o.order_items) ? o.order_items : [];
        return (
          sum +
          items.reduce((s: number, it: { quantity?: number }) => s + (Number(it.quantity) || 1), 0)
        );
      }, 0);

      const allProducts = productsRes.data ?? [];
      const jerseysFromProducts = allProducts.reduce(
        (sum, p) => sum + (Number(p.sold_count) || 0),
        0,
      );

      const totalJerseysSold = Math.max(jerseysFromOrders, jerseysFromProducts);
      const activeProductsCount = allProducts.filter((p) => p.is_active).length;

      // 3. Hitung rata-rata rating pembeli dari pesanan delivered & tabel reviews
      const ratings: number[] = [];

      allOrders
        .filter((o) => o.status === "delivered")
        .forEach((o) => {
          const r = Number(o.testimonial_rating);
          if (r >= 1 && r <= 5) {
            ratings.push(r);
          }
        });

      (reviewsRes.data ?? []).forEach((rev) => {
        const r = Number(rev.rating);
        if (r >= 1 && r <= 5) {
          ratings.push(r);
        }
      });

      const totalReviews = ratings.length;
      const averageRating =
        totalReviews > 0
          ? Number((ratings.reduce((a, b) => a + b, 0) / totalReviews).toFixed(1))
          : 5.0;

      // 4. Persentase kepuasan pembeli (rating >= 4 bintang)
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
    } catch (err) {
      console.error("[TrustStats] Error fetching stats on server:", err);
      return {
        totalCustomers: 0,
        totalJerseysSold: 0,
        averageRating: 5.0,
        totalReviews: 0,
        satisfactionRate: 100,
        activeProductsCount: 0,
      };
    }
  },
);
