import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminAuth } from "@/integrations/supabase/auth-middleware";
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
