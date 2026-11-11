import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/integrations/supabase/auth-middleware";
import { getOrderNetRevenue } from "@/lib/orderFee";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";


const generateDescriptionInputSchema = z.object({
  name: z.string().min(1, "Nama produk tidak boleh kosong"),
  categories: z.string().optional(),
  price: z.string().optional(),
  brand: z.string().optional(),
  team: z.string().optional(),
  league: z.string().optional(),
  country: z.string().optional(),
  release_year: z.string().optional(),
  condition: z.string().optional(),
  authenticity_badge: z.string().optional(),
});

export const generateProductDescription = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(generateDescriptionInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const promptText = `
Anda adalah seorang copywriter ahli untuk toko jersey sepak bola premium, vintage, dan Grade Ori / Original di Indonesia.
Tuliskan deskripsi produk yang sangat menarik, profesional, elegan, dan persuasif (menjual) dalam BAHASA INDONESIA untuk produk jersey berikut:

- Nama Produk: ${data.name}
${data.brand ? `- Brand: ${data.brand}` : ""}
${data.categories ? `- Kategori: ${data.categories}` : ""}
${data.price ? `- Harga: Rp ${data.price}` : ""}
${data.team ? `- Tim / Klub / Negara: ${data.team}` : ""}
${data.league ? `- Liga / Kompetisi: ${data.league}` : ""}
${data.country ? `- Negara: ${data.country}` : ""}
${data.release_year ? `- Tahun Rilis / Musim: ${data.release_year}` : ""}
${data.condition ? `- Kondisi Produk: ${data.condition}` : ""}
${data.authenticity_badge ? `- Grade / Keaslian: ${data.authenticity_badge}` : ""}

Panduan ketat penulisan deskripsi:
1. Bahasa: WAJIB BAHASA INDONESIA yang rapi, mengalir, dan berkelas.
2. Gaya Bahasa & Tone: Antusias, terpercaya, profesional, dan membangkitkan kebanggaan suporter serta kolektor jersey.
3. Format & Tampilan:
   - Tuliskan HANYA dalam bentuk paragraf teks biasa yang bersih dan rapi.
   - JANGAN gunakan format markdown seperti bintang (*), pagar (#), atau teks tebal (**). Tulis teks polos tanpa simbol markdown.
   - JANGAN membuat daftar poin (bullet points) atau mengulang daftar spesifikasi kaku di akhir teks. Fokus pada narasi deskripsi yang mengalir indah.
4. Struktur Deskripsi:
   - Pembuka yang memikat tentang sejarah kejayaan tim, momen ikonik musim tersebut, atau daya tarik desain jersey.
   - Bagian isi yang menjelaskan detail keunggulan bahan (kualitas kain yang adem, jahitan rapi, detail sablon & bordir presisi, kenyamanan dipakai), kondisi barang (${data.condition || "sangat bagus"}), dan grade kualitasnya.
   - Penutup ajakan bertindak (Call to Action) yang kuat untuk segera mengamankan jersey impian sebelum stok habis.
5. Panjang teks: Ringkas dan padat (sekitar 100-150 kata).
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    const attempts = 3;
    let delay = 1000;

    for (let i = 0; i < attempts; i++) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          break;
        }

        // Retry on transient server errors (like 503)
        if (response.status >= 500 && i < attempts - 1) {
          console.warn(`Gemini API returned ${response.status}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      } catch (err) {
        if (i < attempts - 1) {
          console.warn(`Fetch attempt ${i + 1} failed. Retrying in ${delay}ms...`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.ok) {
      const errorStatus = response ? response.status : "unknown";
      const errorText = response ? await response.text() : "No response";
      console.error("Gemini API Error details:", errorText);
      throw new Error(`Failed to generate description. API error: ${errorStatus}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Invalid response format from Gemini API");
    }

    return { description: generatedText.trim() };
  });

const analyzeSalesDataSchema = z.object({
  totalRevenue: z.number(),
  validOrdersCount: z.number(),
  totalCustomersCount: z.number(),
  monthlyRevenue: z.array(
    z.object({
      month: z.string(),
      revenue: z.number(),
    }),
  ),
  bestSellers: z.array(
    z.object({
      name: z.string(),
      sold_count: z.number(),
      stock: z.number(),
      price: z.number(),
      team: z.string().nullable().optional(),
    }),
  ),
  cityDistribution: z.array(
    z.object({
      city: z.string(),
      count: z.number(),
    }),
  ),
});

export const analyzeSalesData = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(analyzeSalesDataSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const monthlyText = data.monthlyRevenue
      .map((m) => `- ${m.month}: Rp ${m.revenue.toLocaleString("id-ID")}`)
      .join("\n");
    const bestSellersText = data.bestSellers
      .map(
        (b) =>
          `- ${b.name} (${b.team || "No Team"}): Terjual ${b.sold_count}, Sisa Stok ${b.stock}, Harga Rp ${b.price.toLocaleString("id-ID")}`,
      )
      .join("\n");
    const cityText = data.cityDistribution.map((c) => `- ${c.city}: ${c.count} pesanan`).join("\n");

    const promptText = `
Anda adalah seorang asisten penjualan pintar dan analis bisnis profesional untuk "AA Jersey", toko online & offline jersey sepak bola authentic, premium, dan retro di Indonesia.
Tolong analisis data penjualan aktual berikut dan buatkan Laporan Strategis & Rekomendasi Bisnis dalam Bahasa Indonesia yang terstruktur rapi, elegan, dan berbobot.

DATA LAPORAN PENJUALAN TOKO:
- Total Pendapatan (Omset): Rp ${data.totalRevenue.toLocaleString("id-ID")}
- Jumlah Pesanan Berhasil: ${data.validOrdersCount} pesanan
- Total Pelanggan Terdata: ${data.totalCustomersCount} pelanggan

Tren Pendapatan Bulanan:
${monthlyText || "Belum ada data bulanan"}

Produk Terlaris & Performa Stok:
${bestSellersText || "Belum ada data produk"}

Distribusi Wilayah Pembeli:
${cityText || "Belum ada data kota"}

PANDUAN FORMAT LAPORAN (WAJIB DIIKUTI DENGAN SANGAT DISIPLIN):
1. Gunakan format Markdown yang kaya dan terstruktur:
   - Gunakan format heading level 2 (##) untuk setiap bab/judul bagian utama.
   - Gunakan format teks tebal (**teks penting**) untuk menyorot angka pendapatan, nama jersey tim populer, persentase, kota utama, atau kata kunci strategi penting.
   - Gunakan bullet points (- ) untuk menjabarkan poin-poin analisis, wawasan data, dan daftar saran strategi.
2. Struktur Laporan:
   ## 1. Analisis Kinerja & Performa Penjualan
   Tinjau pencapaian omset, rata-rata pesanan per pelanggan, dan produk yang menjadi bintang penjualan secara ringkas dan lugas.

   ## 2. Pola Permintaan & Potensi Wilayah
   Identifikasi jersey klub mana yang paling diminati pembeli, analisis konsentrasi wilayah pesanan, dan status sisa stok produk.

   ## 3. Rekomendasi Strategi Bisnis Konkret
   Berikan 3-4 rekomendasi taktis yang siap dieksekusi (misal: strategi restock jersey tim besar, promo ongkir/bundling untuk kota tertentu, strategi aktivasi pelanggan offline/online).

   ## 4. Kesimpulan & Rencana Aksi Prioritas
   Rangkum langkah cepat utama yang disarankan untuk segera dijalankan oleh tim AA Jersey.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    const attempts = 3;
    let delay = 1000;

    for (let i = 0; i < attempts; i++) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
          }),
        });

        if (response.ok) {
          break;
        }

        // Retry on transient server errors
        if (response.status >= 500 && i < attempts - 1) {
          console.warn(
            `Gemini API returned ${response.status} for analysis. Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      } catch (err) {
        if (i < attempts - 1) {
          console.warn(`Analysis fetch attempt ${i + 1} failed. Retrying in ${delay}ms...`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.ok) {
      const errorStatus = response ? response.status : "unknown";
      const errorText = response ? await response.text() : "No response";
      console.error("Gemini API Error details for analysis:", errorText);
      throw new Error(`Failed to generate analysis. API error: ${errorStatus}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Invalid response format from Gemini API for analysis");
    }

    return { analysis: generatedText.trim() };
  });

const suggestProductPriceSchema = z.object({
  name: z.string().min(1),
  categories: z.string().optional(),
  brand: z.string().optional(),
  team: z.string().optional(),
  league: z.string().optional(),
  country: z.string().optional(),
  release_year: z.string().optional(),
  condition: z.string().optional(),
  authenticity_badge: z.string().optional(),
});

export const suggestProductPrice = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(suggestProductPriceSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const promptText = `
Anda adalah seorang ahli penaksir harga barang antik (appraiser) dan analis pasar jersey sepak bola vintage/klasik untuk "AA Jersey".
Tugas Anda adalah menganalisis nilai pasar wajar (fair market value) dari jersey berikut di pasar Indonesia dan internasional:

- Nama Produk: ${data.name}
${data.brand ? `- Brand: ${data.brand}` : ""}
${data.categories ? `- Kategori: ${data.categories}` : ""}
${data.team ? `- Tim: ${data.team}` : ""}
${data.league ? `- Liga: ${data.league}` : ""}
${data.country ? `- Negara asal Tim/Liga: ${data.country}` : ""}
${data.release_year ? `- Tahun Rilis: ${data.release_year}` : ""}
${data.condition ? `- Kondisi: ${data.condition}` : ""}
${data.authenticity_badge ? `- Status Keaslian / Badge: ${data.authenticity_badge}` : ""}

Tolong berikan rekomendasi harga berupa angka bulat rupiah (suggestedPrice) yang wajar beserta penjelasan alasannya (analysis) dalam Bahasa Indonesia yang ramah, sopan, dan profesional.

ATURAN FORMAT RESPONS:
1. Anda HARUS mengembalikan respons berupa format JSON valid berikut saja:
{
  "suggestedPrice": <angka_bulat_harga_dalam_rupiah>,
  "analysis": "<penjelasan_singkat_mengapa_harga_ini_wajar_dalam_bahasa_indonesia>"
}
2. JANGAN sertakan kode markdown seperti \`\`\`json atau pembungkus teks apa pun. Kembalikan string JSON murni saja.
3. Di dalam "analysis", JANGAN GUNAKAN format teks tebal (tanda bintang ganda ** atau asteriks ganda *) di bagian mana pun. Tulis kalimat biasa yang normal, bersih, dan informatif.
4. Nilai harga yang disarankan harus realistis dan pantas untuk jersey sepak bola (misalnya berkisar antara ratusan ribu hingga beberapa juta rupiah tergantung kelangkaan merek, tim, tahun rilis, kondisi, dan status koleksinya).
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    const attempts = 3;
    let delay = 1000;

    for (let i = 0; i < attempts; i++) {
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: promptText,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        });

        if (response.ok) {
          break;
        }

        // Retry on transient server errors
        if (response.status >= 500 && i < attempts - 1) {
          console.warn(
            `Gemini API returned ${response.status} for pricing. Retrying in ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      } catch (err) {
        if (i < attempts - 1) {
          console.warn(`Pricing fetch attempt ${i + 1} failed. Retrying in ${delay}ms...`, err);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }

    if (!response || !response.ok) {
      const errorStatus = response ? response.status : "unknown";
      const errorText = response ? await response.text() : "No response";
      console.error("Gemini API Error details for pricing:", errorText);
      throw new Error(`Failed to generate price suggestion. API error: ${errorStatus}`);
    }

    const result = await response.json();
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error("Invalid response format from Gemini API for pricing");
    }

    try {
      const parsed = JSON.parse(generatedText.trim());
      return {
        suggestedPrice: Number(parsed.suggestedPrice) || 0,
        analysis: String(parsed.analysis || "").trim(),
      };
    } catch (parseErr) {
      console.error("Failed to parse Gemini response as JSON:", generatedText, parseErr);
      throw new Error("Gagal memproses respons harga dari AI");
    }
  });

const EDGEONE_MODELS = [
  "@makers/deepseek-v4-flash",
  "@makers/deepseek-v4-pro",
  "@makers/deepseek-v4.1-flash",
  "@makers/minimax-m3",
  "@makers/kimi-k2.6",
  "@makers/hy3",
  "@makers/hy3-preview",
  "@makers/minimax-m2.7",
];

const EDGEONE_BASE_URL = "https://ai-gateway.edgeone.link/v1/chat/completions";

function cleanModelResponse(text: string): string {
  if (!text) return "";
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function formatDateTimeWIB(isoString: string): string {
  try {
    const d = new Date(isoString);
    return (
      d.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }) + " WIB"
    );
  } catch {
    return isoString;
  }
}

async function fetchStoreContext(): Promise<string> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [
      productsRes,
      ordersRes,
      profilesRes,
      txsRes,
      categoriesRes,
      vouchersRes,
      customerRolesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("products")
        .select("id, name, brand, team, price, cost_price, stock, sizes, size_stock, sold_count, is_active"),
      supabaseAdmin
        .from("orders")
        .select(
          `id, order_number, user_id, status, grand_total, subtotal, discount_amount, shipping_cost, courier, recipient_name, recipient_no_hp, recipient_kota, recipient_alamat, note, created_at, order_items(product_id, product_name, quantity, size, unit_price, cost_price, subtotal)`,
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email, nama_lengkap"),
      supabaseAdmin
        .from("financial_transactions")
        .select("id, transaction_date, type, category, amount, description")
        .order("transaction_date", { ascending: false }),
      supabaseAdmin.from("categories").select("id, name, slug"),
      supabaseAdmin
        .from("vouchers")
        .select("id, code, discount_type, discount_value, min_purchase, status"),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "customer"),
    ]);

    if (ordersRes.error) {
      console.error("[askAdminAIAssistant] Error fetching orders:", ordersRes.error);
    }
    if (productsRes.error) {
      console.error("[askAdminAIAssistant] Error fetching products:", productsRes.error);
    }
    if (txsRes.error) {
      console.error("[askAdminAIAssistant] Error fetching financial_transactions:", txsRes.error);
    }

    const products = productsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const txs = txsRes.data ?? [];
    const categories = categoriesRes.data ?? [];
    const vouchers = vouchersRes.data ?? [];
    const customersCount = customerRolesRes.data?.length ?? 0;

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // 1. Build product cost lookup (HPP per product & size variant)
    const productCostMap: Record<
      string,
      { name: string; team: string; defaultCost: number; sizeCost: Record<string, number> }
    > = {};
    let totalInventoryCost = 0;
    let totalInventoryStock = 0;

    products.forEach((p) => {
      const rawStock = (p.size_stock as Record<string, any> | null) ?? {};
      const sizeCostObj = (rawStock["_cost_prices"] || (p as any).size_cost_price || {}) as Record<
        string,
        any
      >;
      const sizeCost: Record<string, number> = {};
      Object.entries(sizeCostObj).forEach(([sz, c]) => {
        if (Number(c) > 0) sizeCost[sz.toUpperCase().trim()] = Number(c);
      });
      const defaultCost = Number(p.cost_price || 0);
      const stockQty = Number(p.stock || 0);
      totalInventoryStock += stockQty;
      totalInventoryCost += stockQty * defaultCost;

      productCostMap[p.id] = {
        name: p.name,
        team: p.team || "-",
        defaultCost,
        sizeCost,
      };
      if (p.name) {
        productCostMap[p.name] = productCostMap[p.id];
      }
    });

    const activeProducts = products.filter((p) => p.is_active);
    const lowStockProducts = activeProducts.filter(
      (p) => Number(p.stock) <= 3 && Number(p.stock) > 0,
    );
    const outOfStockProducts = activeProducts.filter((p) => Number(p.stock) === 0);
    const topSellers = [...activeProducts]
      .sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0))
      .slice(0, 8);

    // 2. Process all orders (HPP, profit, items, buyer info)
    const validOrders = orders.filter((o) =>
      ["paid", "processing", "shipped", "delivered"].includes(o.status),
    );

    let totalOmsetNetto = 0;
    let totalHppSold = 0;
    let totalItemsSold = 0;
    const buyerSummaryMap: Record<
      string,
      { name: string; city: string; phone: string; orderCount: number; totalSpent: number }
    > = {};
    const productSalesMap: Record<
      string,
      { name: string; team: string; qty: number; revenue: number; cost: number; profit: number }
    > = {};

    const enrichedOrders = orders.map((o) => {
      const isValid = ["paid", "processing", "shipped", "delivered"].includes(o.status);
      const netRevenue = isValid ? getOrderNetRevenue(o) : 0;
      const items = (o.order_items as any[]) || [];
      let orderHpp = 0;
      let orderQty = 0;

      const itemsDetailList = items.map((it) => {
        const qty = Number(it.quantity) || 1;
        orderQty += qty;
        const szKey = it.size ? String(it.size).toUpperCase().trim() : "";
        const prodInfo = productCostMap[it.product_id] || productCostMap[it.product_name];
        const itemSizeCost = szKey && prodInfo?.sizeCost?.[szKey];
        const unitCost =
          Number(it.cost_price) > 0
            ? Number(it.cost_price)
            : itemSizeCost !== undefined && Number(itemSizeCost) > 0
              ? Number(itemSizeCost)
              : prodInfo?.defaultCost || 0;
        const totalItemCost = unitCost * qty;
        orderHpp += totalItemCost;

        if (isValid) {
          const prodKey = it.product_id || it.product_name || "unknown";
          if (!productSalesMap[prodKey]) {
            const matched = products.find((p) => p.id === it.product_id || p.name === it.product_name);
            productSalesMap[prodKey] = {
              name: it.product_name || matched?.name || "Jersey",
              team: matched?.team || "-",
              qty: 0,
              revenue: 0,
              cost: 0,
              profit: 0,
            };
          }
          productSalesMap[prodKey].qty += qty;
          productSalesMap[prodKey].revenue += (Number(it.unit_price) || 0) * qty;
          productSalesMap[prodKey].cost += totalItemCost;
          productSalesMap[prodKey].profit =
            productSalesMap[prodKey].revenue - productSalesMap[prodKey].cost;
        }

        const unitPriceNum = Number(it.unit_price) || 0;
        return `${it.product_name || "Jersey"}${it.size ? ` (Size ${it.size})` : ""} x${qty} pcs @ Rp ${unitPriceNum.toLocaleString("id-ID")}${unitCost > 0 ? ` (HPP: Rp ${unitCost.toLocaleString("id-ID")})` : ""}`;
      });

      const orderProfit = isValid ? Math.max(0, netRevenue - orderHpp) : 0;

      const userProfile = o.user_id ? profileMap.get(o.user_id) : null;
      const buyerName =
        (o.recipient_name || "").trim() ||
        userProfile?.nama_lengkap ||
        userProfile?.email ||
        "Pelanggan Toko";
      const buyerCity = o.recipient_kota || "Tidak tertera";
      const buyerPhone = o.recipient_no_hp || "-";

      if (isValid) {
        totalOmsetNetto += netRevenue;
        totalHppSold += orderHpp;
        totalItemsSold += orderQty;

        const buyerKey = buyerName.toLowerCase();
        if (!buyerSummaryMap[buyerKey]) {
          buyerSummaryMap[buyerKey] = {
            name: buyerName,
            city: buyerCity,
            phone: buyerPhone,
            orderCount: 0,
            totalSpent: 0,
          };
        }
        buyerSummaryMap[buyerKey].orderCount += 1;
        buyerSummaryMap[buyerKey].totalSpent += netRevenue;
      }

      return {
        id: o.id,
        orderNumber: o.order_number,
        buyerName,
        buyerPhone,
        city: buyerCity,
        status: o.status,
        courier: o.courier || "COD / Kurir Toko",
        grandTotal: Number(o.grand_total) || 0,
        netRevenue,
        orderHpp,
        orderProfit,
        itemsDetailList,
        dateFormatted: formatDateTimeWIB(o.created_at),
        createdAt: o.created_at,
      };
    });

    // 3. Operational & Overall Financials
    const totalLabaKotorJersey = totalOmsetNetto - totalHppSold;
    const totalPengeluaranOperasional = txs
      .filter((t) => t.type === "out")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalLabaBersih = totalLabaKotorJersey - totalPengeluaranOperasional;
    const grossProfitMarginPercent =
      totalOmsetNetto > 0 ? ((totalLabaKotorJersey / totalOmsetNetto) * 100).toFixed(1) : "0";
    const netProfitMarginPercent =
      totalOmsetNetto > 0 ? ((totalLabaBersih / totalOmsetNetto) * 100).toFixed(1) : "0";

    const pendingOrders = orders.filter((o) => o.status === "pending").length;
    const processingOrders = orders.filter((o) => o.status === "processing").length;
    const shippedOrders = orders.filter((o) => o.status === "shipped").length;
    const deliveredOrders = orders.filter((o) => o.status === "delivered").length;
    const cancelledOrders = orders.filter((o) => o.status === "cancelled").length;

    const codOrders = validOrders.filter(
      (o) => o.courier === "COD" || (o.recipient_kota || "").toLowerCase().includes("cimahi"),
    ).length;
    const expeditionOrders = validOrders.length - codOrders;

    // Top buyers list
    const topBuyers = Object.values(buyerSummaryMap)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    // Recent orders formatted list (up to 25 recent orders with deep details)
    const recentOrdersText = enrichedOrders
      .slice(0, 25)
      .map((ord, idx) => {
        return `${idx + 1}. [${ord.orderNumber}] Tanggal: ${ord.dateFormatted}
   - Pembeli: ${ord.buyerName} | Kota: ${ord.city} | No HP: ${ord.buyerPhone}
   - Status: ${ord.status.toUpperCase()} | Pengiriman: ${ord.courier}
   - Total Transaksi: Rp ${ord.grandTotal.toLocaleString("id-ID")} | HPP Modal: Rp ${ord.orderHpp.toLocaleString("id-ID")} | Laba Pesanan: Rp ${ord.orderProfit.toLocaleString("id-ID")}
   - Item Dibeli: ${ord.itemsDetailList.join("; ") || "Tidak ada detail item"}`;
      })
      .join("\n\n");

    return `
=== DATA REAL-TIME LENGKAP OPERASIONAL & PENJUALAN TOKO AA JERSEY ===
Nama Toko: AA Jersey
Lokasi Outlet/Gudang: Kota Cimahi, Jawa Barat (WhatsApp Resmi: 0895-8088-60080)
Spesialisasi: Jersey Grade Ori Thailand 1:1, Jersey Original resmi, Koleksi Retro & Vintage (90-an/2000-an), Jersey Klub Eropa & Timnas Dunia.

1. RINGKASAN KEUANGAN & LABA BERSIH (DATA VALID & LENGKAP):
- Total Omset Riil (Pesanan Valid Berbayar): Rp ${totalOmsetNetto.toLocaleString("id-ID")} (${validOrders.length} Pesanan Berhasil)
- Total Modal Jersey Terjual (HPP / COGS): Rp ${totalHppSold.toLocaleString("id-ID")} (${totalItemsSold} pcs terjual)
- Total Laba Kotor Penjualan Jersey: Rp ${totalLabaKotorJersey.toLocaleString("id-ID")} (Margin Laba Kotor: ${grossProfitMarginPercent}%)
- Total Pengeluaran Operasional Toko (Sewa, Packaging, dll): Rp ${totalPengeluaranOperasional.toLocaleString("id-ID")}
- TOTAL LABA BERSIH (NET PROFIT) TOKO: Rp ${totalLabaBersih.toLocaleString("id-ID")} (Margin Laba Bersih: ${netProfitMarginPercent}%)
- Total Jersey Terjual (Volume): ${totalItemsSold} pcs
- Total Modal Dagang Tersimpan di Stok Gudang (Inventaris): Rp ${totalInventoryCost.toLocaleString("id-ID")} (${totalInventoryStock} pcs tersedia)

2. STATUS & OPERASIONAL PESANAN TOKO:
- Total Pesanan Berhasil: ${validOrders.length} pesanan
- Total Seluruh Riwayat Pesanan: ${orders.length} pesanan
- Perlu Segera Diproses / Dikemas (Processing): ${processingOrders} pesanan
- Menunggu Pembayaran (Pending): ${pendingOrders} pesanan
- Sedang Dikirim Ekspedisi (Shipped): ${shippedOrders} pesanan
- Berhasil Diterima Pembeli (Delivered): ${deliveredOrders} pesanan
- Dibatalkan (Cancelled): ${cancelledOrders} pesanan
- Metode Pengiriman: ${codOrders} pesanan COD (Ketemuan Langsung Cimahi/Bandung), ${expeditionOrders} pesanan Ekspedisi (JNE/J&T/Lion Parcel)

3. DAFTAR PESANAN & PENJUALAN TERBARU (DETAIL LENGKAP):
${recentOrdersText || "Belum ada pesanan terbaru."}

4. PELANGGAN TERATAS & PALING SERING BELANJA (TOP BUYERS):
${
  topBuyers.length > 0
    ? topBuyers
        .map(
          (b, i) =>
            `${i + 1}. ${b.name} (${b.city}, HP: ${b.phone}): ${b.orderCount} pesanan | Total Belanja: Rp ${b.totalSpent.toLocaleString("id-ID")}`,
        )
        .join("\n")
    : "Belum ada data pelanggan."
}
- Total Akun Pelanggan Terdaftar: ${customersCount} akun

5. KATALOG, STOK & PERFORMA PRODUK:
- Total Produk Terdaftar: ${products.length} produk (${activeProducts.length} aktif dijual)
- Kategori Produk: ${categories.map((c) => c.name).join(", ") || "Jersey Grade Ori, Retro, Original"}
- Produk Terlaris (Top Sellers):
${
  topSellers.length > 0
    ? topSellers
        .map(
          (p) =>
            `  * ${p.name} (${p.team || "Umum"}): Terjual ${p.sold_count} pcs | Stok Sisa: ${p.stock} pcs | Harga: Rp ${Number(p.price).toLocaleString("id-ID")} | HPP Modal: Rp ${Number(p.cost_price || 0).toLocaleString("id-ID")}`,
        )
        .join("\n")
    : "  * Belum ada data produk"
}
- Produk Stok Kritis (Sisa <= 3 pcs):
${
  lowStockProducts.length > 0
    ? lowStockProducts
        .slice(0, 10)
        .map(
          (p) =>
            `  * ${p.name}: Sisa ${p.stock} pcs (Harga Rp ${Number(p.price).toLocaleString("id-ID")})`,
        )
        .join("\n")
    : "  * Aman, tidak ada produk dengan stok kritis."
}
- Produk Stok Habis (0 pcs): ${outOfStockProducts.length} produk

6. VOUCHER DISKON AKTIF:
${
  vouchers.filter((v) => v.status === "active").length > 0
    ? vouchers
        .filter((v) => v.status === "active")
        .map(
          (v) =>
            `  * Kode "${v.code}": Diskon ${v.discount_type === "percentage" ? `${v.discount_value}%` : `Rp ${Number(v.discount_value).toLocaleString("id-ID")}`} (Min Belanja: Rp ${Number(v.min_purchase).toLocaleString("id-ID")})`,
        )
        .join("\n")
    : "  * Tidak ada voucher aktif saat ini."
}
=== AKHIR DATA TOKO ===`;
  } catch (err) {
    console.error("[askAdminAIAssistant] Error fetching store context:", err);
    return `=== DATA OPERASIONAL TOKO AA JERSEY ===\nNama Toko: AA Jersey (Cimahi, Jawa Barat)\nSpesialisasi: Jersey Grade Ori Thailand 1:1, Jersey Original, dan Koleksi Retro.\n(Detail data database dinamis sedang dimuat ulang).\n=== AKHIR DATA ===`;
  }
}

const adminChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const askAdminAIAssistantSchema = z.object({
  messages: z.array(adminChatMessageSchema),
});

export const askAdminAIAssistant = createServerFn({ method: "POST" })
  .middleware([requireAdminAuth])
  .validator(askAdminAIAssistantSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.EDGEONE_API_KEY;
    if (!apiKey) {
      throw new Error("EDGEONE_API_KEY belum dikonfigurasi di file .env");
    }

    const storeContext = await fetchStoreContext();

    const systemPrompt = `Anda adalah "Asisten Toko AA Jersey", asisten pribadi resmi dan konsultan bisnis untuk Admin Toko AA Jersey.

PEDOMAN UTAMA & PEMBATASAN RUANG LINGKUP KETAT (STRICT SCOPE):
1. RUANG LINGKUP & KEMAMPUAN LENGKAP: Anda memiliki AKSES LENGKAP & REAL-TIME ke seluruh data operasional toko AA Jersey di bawah:
   - Manajemen Pesanan: nomor pesanan, nama pembeli terbaru, nomor HP, kota, status pesanan, kurir/COD, serta item yang dipesan.
   - Keuangan & Laba: omset riil, modal produk/HPP per item dan total HPP, pengeluaran operasional toko, laba kotor, dan laba bersih (net profit) beserta persentase margin keuntungan.
   - Katalog & Stok Produk: sisa stok jersey, produk terlaris, produk menipis/habis, varian ukuran, dan harga.
   - Pelanggan & Promosi: akun terdaftar, pembeli teratas/loyal, voucher diskon aktif.
2. PANDUAN MENJAWAB PERTANYAAN ADMIN:
   - Jika admin menanyakan "siapa pembeli terbaru", "apa pesanan terakhir", atau hal serupa, SEBUTKAN NAMA-NAMA PEMBELI TERBARU dari daftar pesanan di bawah beserta item yang dibeli, nomor pesanan, dan nominal transaksinya.
   - Jika admin menanyakan "berapa keuntungan/laba toko", "apakah keuangan sehat", atau "berapa laba bersih", JELASKAN DENGAN ANGKA RINCI dari data: omset riil, total modal HPP penjualan, pengeluaran operasional, dan laba bersih riil.
   - JANGAN PERNAH berkata Anda tidak memiliki data nama pembeli atau tidak memiliki data HPP/modal/keuntungan bersih, karena seluruh data tersebut SUDAH LENGKAP tersedia di bawah.
3. JIKA DITANYA DI LUAR TOKO: Jika admin menanyakan hal yang sama sekali di luar konteks toko AA Jersey (misal: coding umum, politik dunia, resep kuliner, matematika murni), tolak secara sopan, hangat, dan ramah:
   "Maaf, sebagai asisten toko AA Jersey, saya hanya bertugas membantu operasional toko, data produk, stok, laporan penjualan, pesanan, dan keuangan AA Jersey. Ada yang bisa saya bantu terkait toko kita?"
4. KEASLIAN DATA (ANTI-HALUSINASI): Gunakan HANYA data dan angka yang tercantum di bawah. Jangan mengarang angka yang tidak ada.
5. GAYA PENULISAN:
   - Gunakan Bahasa Indonesia yang luwes, manusiawi, ramah, dan profesional seperti rekan kerja terpercaya.
   - Sajikan data penting dengan teks tebal (**angka/nama**) dan gunakan daftar poin (- ) agar nyaman dibaca.
   - Pastikan selalu menyelesaikan kalimat, penjelasan, dan kesimpulan secara tuntas hingga selesai (jangan terpotong di tengah kalimat).
6. ATURAN EMOJI (SANGAT KETAT): DILARANG MENGGUNAKAN EMOJI APAPUN. Jangan gunakan emotikon, simbol grafis, atau emoji di bagian mana pun dalam jawaban Anda. Tulis teks bersih dan profesional.

${storeContext}`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...data.messages.slice(-8), // Ambil hingga 8 riwayat pesan terakhir untuk context window yang optimal
    ];

    let lastError: Error | null = null;
    let successfulReply = "";
    let usedModel = "";

    // Multi-model fallback loop
    for (const modelName of EDGEONE_MODELS) {
      try {
        console.log(`[EdgeOne AI Co-Pilot] Trying model: ${modelName}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35000); // 35 detik timeout per model

        const response = await fetch(EDGEONE_BASE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            messages: formattedMessages,
            max_tokens: 3000,
            temperature: 0.5,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.warn(
            `[EdgeOne AI Co-Pilot] Model ${modelName} returned status ${response.status}: ${errText.slice(0, 150)}`,
          );
          lastError = new Error(`Model ${modelName} status ${response.status}`);
          continue; // Coba model cadangan berikutnya
        }

        const json = await response.json();
        const choice = json.choices?.[0];
        let rawContent = choice?.message?.content || choice?.message?.reasoning_content || "";
        const cleaned = cleanModelResponse(rawContent);

        if (cleaned) {
          successfulReply = cleaned;
          usedModel = modelName;
          console.log(`[EdgeOne AI Co-Pilot] Success with model: ${modelName}`);
          break; // Berhasil! Keluar dari loop fallback
        } else {
          console.warn(`[EdgeOne AI Co-Pilot] Model ${modelName} returned empty text, trying next...`);
        }
      } catch (err: any) {
        console.warn(`[EdgeOne AI Co-Pilot] Model ${modelName} failed with error:`, err.message);
        lastError = err;
      }
    }

    if (!successfulReply) {
      throw new Error(
        `Semua model EdgeOne AI Gateway sedang sibuk atau tidak merespon: ${lastError?.message || "Koneksi gagal"}. Silakan coba lagi sesaat lagi.`,
      );
    }

    return {
      reply: successfulReply,
      modelUsed: usedModel,
      timestamp: new Date().toISOString(),
    };
  });
