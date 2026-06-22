import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  .validator(generateDescriptionInputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const promptText = `
You are an expert copywriter for premium international sports brands and vintage football jersey retailers.
Write a professional, highly engaging, and sales-oriented product description in English for the following jersey:

- Product Name: ${data.name}
${data.brand ? `- Brand: ${data.brand}` : ""}
${data.categories ? `- Category: ${data.categories}` : ""}
${data.price ? `- Price: Rp ${data.price}` : ""}
${data.team ? `- Team: ${data.team}` : ""}
${data.league ? `- League: ${data.league}` : ""}
${data.country ? `- Country of Team/League: ${data.country}` : ""}
${data.release_year ? `- Release Year: ${data.release_year}` : ""}
${data.condition ? `- Condition: ${data.condition}` : ""}
${data.authenticity_badge ? `- Authenticity Status: ${data.authenticity_badge}` : ""}

The description must adhere to the following strict guidelines:
1. Tone: Professional, premium, exciting, and highly persuasive (selling).
2. Language: English only (do not use Indonesian or other languages).
3. Format & Styling: 
   - Output ONLY plain text in normal paragraphs.
   - Do NOT use any markdown formatting, asterisks (*), hashtags (#), or bold text (**). Write pure, clean paragraphs.
   - Do NOT include any bulleted lists, specification lists, or repeat key-value parameters (like Brand: Nike, Team: Arsenal) at the end of the text. Focus entirely on the narrative description.
4. Structure:
   - A captivating opening highlighting the jersey's heritage, team history, season significance, or vintage appeal.
   - A descriptive body mentioning its premium brand craftsmanship, design elements, superb condition (${data.condition || "excellent"}), and verified authenticity.
   - A strong, urging closing call-to-action for football fans and jersey collectors.
5. Length: Keep it concise but premium (approximately 100-150 words).
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    let attempts = 3;
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
  monthlyRevenue: z.array(z.object({
    month: z.string(),
    revenue: z.number(),
  })),
  bestSellers: z.array(z.object({
    name: z.string(),
    sold_count: z.number(),
    stock: z.number(),
    price: z.number(),
    team: z.string().nullable().optional(),
  })),
  cityDistribution: z.array(z.object({
    city: z.string(),
    count: z.number(),
  })),
});

export const analyzeSalesData = createServerFn({ method: "POST" })
  .validator(analyzeSalesDataSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const monthlyText = data.monthlyRevenue.map((m) => `- ${m.month}: Rp ${m.revenue.toLocaleString("id-ID")}`).join("\n");
    const bestSellersText = data.bestSellers.map((b) => `- ${b.name} (${b.team || "No Team"}): Terjual ${b.sold_count}, Sisa Stok ${b.stock}, Harga Rp ${b.price.toLocaleString("id-ID")}`).join("\n");
    const cityText = data.cityDistribution.map((c) => `- ${c.city}: ${c.count} pesanan`).join("\n");

    const promptText = `
Anda adalah seorang asisten penjualan pintar dan analis data profesional untuk "The Locker Room", sebuah toko online yang menjual jersey sepak bola premium dan klasik.
Tolong analisis data penjualan berikut dan berikan laporan strategi bisnis serta rekomendasi konkret untuk masa depan.

DATA LAPORAN PENJUALAN:
- Total Pendapatan (Revenue): Rp ${data.totalRevenue.toLocaleString("id-ID")}
- Jumlah Pesanan Valid: ${data.validOrdersCount}
- Jumlah Pelanggan Terdaftar: ${data.totalCustomersCount}

Tren Pendapatan Bulanan:
${monthlyText || "Belum ada data bulanan"}

Produk Terlaris (Best Sellers):
${bestSellersText || "Belum ada data produk terlaris"}

Distribusi Geografis Pelanggan (Kota Terpopuler):
${cityText || "Belum ada data kota"}

Tolong berikan analisis komprehensif Anda dalam Bahasa Indonesia yang ramah, sopan, profesional, dan bersifat suportif (tidak terkesan menekan atau mendikte).
Format respons Anda harus bersih, rapi, dan mudah dibaca:
1. GUNAKAN paragraf normal, spasi baris kosong untuk pemisah paragraf, dan daftar bernomor/bullet biasa (tanda strip "-") untuk daftar rekomendasi.
2. JANGAN GUNAKAN format teks tebal (seperti tanda bintang ganda ** atau asteriks tunggal *) di bagian mana pun dalam teks. Buat seluruh teks menjadi tulisan biasa yang normal namun terstruktur rapi dengan judul/pemisah sederhana.
3. Struktur laporan harus mencakup:
   - Analisis Kinerja Penjualan Saat Ini: Tinjau pencapaian total pendapatan, performa bulanan, dan produk terlaris secara ringkas.
   - Prediksi Tren & Permintaan Masa Depan: Estimasi jersey tim atau kategori mana yang berpotensi tinggi ke depannya berdasarkan data stok, penjualan, atau daerah pemasaran.
   - Saran Strategi Bisnis Konkret: Berikan 3-4 rekomendasi bisnis yang praktis dan bisa langsung dijalankan (misalnya pengelolaan stok jersey terpopuler, promosi khusus di daerah dengan penjualan tinggi, taktik bundling, atau strategi retensi pelanggan).
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    let attempts = 3;
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
          console.warn(`Gemini API returned ${response.status} for analysis. Retrying in ${delay}ms...`);
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
  .validator(suggestProductPriceSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment");
    }

    const promptText = `
Anda adalah seorang ahli penaksir harga barang antik (appraiser) dan analis pasar jersey sepak bola vintage/klasik untuk "The Locker Room".
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

    let response: Response | null = null;
    let attempts = 3;
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
              responseMimeType: "application/json"
            }
          }),
        });

        if (response.ok) {
          break;
        }

        // Retry on transient server errors
        if (response.status >= 500 && i < attempts - 1) {
          console.warn(`Gemini API returned ${response.status} for pricing. Retrying in ${delay}ms...`);
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

