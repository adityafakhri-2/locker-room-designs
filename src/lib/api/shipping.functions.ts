import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import rajaongkirCities from "../data/rajaongkir_cities.json";

interface City {
  city_id: string;
  province_id: string;
  province: string;
  type: string;
  city_name: string;
  postal_code: string;
}

const cities = rajaongkirCities as City[];

// Fungsi pembantu untuk membersihkan nama wilayah agar pencocokan lebih akurat
function cleanName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Fungsi untuk mencocokkan kota & provinsi dengan data RajaOngkir
function findRajaOngkirCity(provName: string, cityName: string): City | undefined {
  if (!provName || !cityName) return undefined;
  const targetProvClean = cleanName(provName);
  const targetCityClean = cleanName(cityName);

  // 1. Coba pencocokan persis (setelah dibersihkan)
  let matched = cities.find((c) => {
    const cProvClean = cleanName(c.province);
    const cCityClean = cleanName(c.city_name);
    return cProvClean === targetProvClean && cCityClean === targetCityClean;
  });

  if (matched) return matched;

  // 2. Coba pencocokan parsial jika persis gagal (misal untuk menangani perbedaan penulisan provinsi)
  matched = cities.find((c) => {
    const cProvClean = cleanName(c.province);
    const cCityClean = cleanName(c.city_name);
    return cProvClean.includes(targetProvClean) && cCityClean === targetCityClean;
  });

  return matched;
}

// Fungsi untuk mendapatkan kota asal dinamis dari profil Admin di Supabase
async function getAdminOrigin(): Promise<{
  city_id: string;
  city_name: string;
  province: string;
  kecamatan: string;
}> {
  // Default fallback: Jakarta Selatan (153)
  const defaultOrigin = {
    city_id: "153",
    city_name: "Jakarta Selatan",
    province: "DKI Jakarta",
    kecamatan: "",
  };

  try {
    // Impor supabaseAdmin secara dinamis agar hanya dieksekusi di sisi server
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Cari user dengan role 'admin'
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (roleError || !userRole) {
      console.warn(
        "[Shipping API] Tidak ada user dengan role admin. Menggunakan origin default (Jakarta Selatan).",
      );
      return defaultOrigin;
    }

    // 2. Ambil profil user tersebut (alamat, kota & provinsi)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("alamat, kota, provinsi")
      .eq("id", userRole.user_id)
      .maybeSingle();

    if (profileError || !profile || !profile.kota) {
      console.warn(
        "[Shipping API] Profil admin tidak ditemukan atau kolom kota kosong. Menggunakan origin default.",
      );
      return defaultOrigin;
    }

    // 3. Cocokkan kota admin ke RajaOngkir ID
    const matchedCity = findRajaOngkirCity(profile.provinsi || "", profile.kota);
    if (!matchedCity) {
      console.warn(
        `[Shipping API] Kota admin "${profile.kota}" tidak cocok dengan data RajaOngkir. Menggunakan origin default.`,
      );
      return defaultOrigin;
    }

    // Ekstrak kecamatan dari alamat admin
    let kecamatan = "";
    if (profile.alamat) {
      const matchKecKel = profile.alamat.match(/(.*?),\s*Kec\.\s*([^,]+),\s*Kel\.\s*([^,]+)$/i);
      if (matchKecKel) {
        kecamatan = matchKecKel[2].trim();
      } else {
        const matchKelKec = profile.alamat.match(/(.*?),\s*Kel\.\s*([^,]+),\s*Kec\.\s*([^,]+)$/i);
        if (matchKelKec) {
          kecamatan = matchKelKec[3].trim();
        }
      }
    }

    console.log(
      `[Shipping API] Kota asal admin berhasil dideteksi secara dinamis: ${matchedCity.city_name} (Kecamatan: ${kecamatan})`,
    );
    return {
      city_id: matchedCity.city_id,
      city_name: matchedCity.city_name,
      province: matchedCity.province,
      kecamatan,
    };
  } catch (err) {
    console.error("[Shipping API] Error saat mendapatkan kota asal admin:", err);
    return defaultOrigin;
  }
}

// Helper untuk mencari ID V2 RajaOngkir
async function searchRajaOngkirV2Destination(
  keyword: string,
  apiKey: string,
): Promise<number | null> {
  try {
    const url = `https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${encodeURIComponent(keyword)}&limit=5`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        key: apiKey,
      },
    });

    if (!response.ok) {
      console.error(`[Shipping API] Search API returned status ${response.status}`);
      return null;
    }

    const resJson = await response.json();
    if (resJson.meta?.status === "success" && resJson.data && resJson.data.length > 0) {
      // Mengembalikan ID dari hasil pertama
      return resJson.data[0].id;
    }
    return null;
  } catch (err) {
    console.error(`[Shipping API] Error in searchRajaOngkirV2Destination for "${keyword}":`, err);
    return null;
  }
}

// Skema input untuk menghitung ongkir
const calculateShippingRatesInput = z.object({
  destinationProvinsi: z.string().min(1),
  destinationKota: z.string().min(1),
  destinationKecamatan: z.string().optional(),
  totalQuantity: z.number().int().positive(),
});

export interface ShippingService {
  service: string; // REG, YES, OKE
  name: string; // JNE REG, JNE YES, JNE OKE
  description: string; // Layanan Reguler, dsb.
  cost: number;
  etd: string; // 1-2 hari
}

// Hitung ongkir fallback offline berdasarkan kota asal/tujuan, zona provinsi, dan berat
function calculateOfflineRates(
  destProvince: string,
  destCity: string,
  originCity: string,
  weightGrams: number,
): ShippingService[] {
  const p = destProvince.toLowerCase();
  const cDest = destCity
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab)\.?\s+/i, "")
    .trim();
  const cOrigin = originCity
    .toLowerCase()
    .replace(/^(kota|kabupaten|kab)\.?\s+/i, "")
    .trim();

  let baseRatePerKg = 15000; // Default fallback umum

  // Jika kota asal dan kota tujuan sama (intra-city/lokal)
  if (cDest && cOrigin && cDest === cOrigin) {
    baseRatePerKg = 8000; // Tarif pengiriman lokal
  } else if (p.includes("jakarta")) {
    baseRatePerKg = 9000;
  } else if (p.includes("banten") || (p.includes("jawa") && p.includes("barat"))) {
    baseRatePerKg = 11000;
  } else if (p.includes("tengah") || p.includes("yogyakarta") || p.includes("timur")) {
    baseRatePerKg = 16000;
  } else if (p.includes("bali")) {
    baseRatePerKg = 22000;
  } else if (
    p.includes("sumatera") ||
    p.includes("aceh") ||
    p.includes("riau") ||
    p.includes("jambi") ||
    p.includes("bengkulu") ||
    p.includes("lampung") ||
    p.includes("bangka")
  ) {
    baseRatePerKg = 25000;
  } else if (p.includes("kalimantan")) {
    baseRatePerKg = 32000;
  } else if (p.includes("sulawesi") || p.includes("gorontalo")) {
    baseRatePerKg = 35000;
  } else if (p.includes("nusa tenggara") || p.includes("ntb") || p.includes("ntt")) {
    baseRatePerKg = 38000;
  } else if (p.includes("maluku") || p.includes("papua")) {
    baseRatePerKg = 55000;
  }

  const kg = Math.ceil(weightGrams / 1000);
  const costReg = baseRatePerKg * kg;
  const costYes = (baseRatePerKg + 10000) * kg;
  const costOke = Math.max(9000, baseRatePerKg - 2000) * kg;

  return [
    {
      service: "REG",
      name: "JNE REG",
      description: "Layanan Reguler",
      cost: costReg,
      etd: "1-3 hari",
    },
    {
      service: "YES",
      name: "JNE YES",
      description: "Yakin Esok Sampai",
      cost: costYes,
      etd: "1 hari",
    },
  ];
}

// Server function untuk menghitung tarif pengiriman JNE
export const calculateShippingRates = createServerFn({ method: "POST" })
  .inputValidator(calculateShippingRatesInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.RAJAONGKIR_API_KEY;

    // Estimasi berat jersey: 200 gram per pcs
    const weightGrams = data.totalQuantity * 200;

    // 1. Dapatkan kota asal (Admin) secara dinamis
    const origin = await getAdminOrigin();

    // 2. Cari ID V2 untuk origin dan destination
    let originV2Id: number | null = null;
    let destV2Id: number | null = null;

    if (apiKey) {
      // Cari origin V2 ID
      const originKeyword = origin.kecamatan
        ? `${origin.kecamatan} ${origin.city_name}`
        : origin.city_name;
      originV2Id = await searchRajaOngkirV2Destination(originKeyword, apiKey);
      if (!originV2Id && origin.kecamatan) {
        originV2Id = await searchRajaOngkirV2Destination(origin.city_name, apiKey);
      }

      // Cari destination V2 ID
      const destKeyword = data.destinationKecamatan
        ? `${data.destinationKecamatan} ${data.destinationKota}`
        : data.destinationKota;
      destV2Id = await searchRajaOngkirV2Destination(destKeyword, apiKey);
      if (!destV2Id && data.destinationKecamatan) {
        destV2Id = await searchRajaOngkirV2Destination(data.destinationKota, apiKey);
      }
    }

    // Jika API Key tidak diset atau ID V2 tidak didapatkan, gunakan fallback offline
    if (!apiKey || !originV2Id || !destV2Id) {
      console.warn(
        "[Shipping API] Menggunakan fallback offline karena API Key tidak dikonfigurasi atau ID V2 tidak ditemukan.",
        {
          hasApiKey: !!apiKey,
          originV2Id,
          destV2Id,
        },
      );
      return {
        success: true,
        rates: calculateOfflineRates(
          data.destinationProvinsi,
          data.destinationKota,
          origin.city_name,
          weightGrams,
        ),
        originCity: origin.city_name,
        originProvince: origin.province,
        destCity: data.destinationKota,
        weightGrams,
        isMock: true,
      };
    }

    try {
      console.log(
        `[Shipping API] Mengambil ongkir real-time V2 dari ${origin.city_name} (ID V2: ${originV2Id}) ke ${data.destinationKota} (ID V2: ${destV2Id}) dengan berat ${weightGrams} gram`,
      );

      // Request ke API Komerce V2
      const bodyParams = new URLSearchParams();
      bodyParams.append("origin", originV2Id.toString());
      bodyParams.append("destination", destV2Id.toString());
      bodyParams.append("weight", weightGrams.toString());
      bodyParams.append("courier", "jne");

      const response = await fetch("https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost", {
        method: "POST",
        headers: {
          key: apiKey,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      });

      if (!response.ok) {
        throw new Error(`RajaOngkir V2 API returned status ${response.status}`);
      }

      const resJson = await response.json();
      const results = resJson.data;

      if (!results || !Array.isArray(results) || results.length === 0) {
        throw new Error("Respons RajaOngkir V2 kosong atau tidak memiliki data tarif.");
      }

      // Map hasil dari RajaOngkir V2 ke format kita (hanya JNE REG dan YES)
      const rates: ShippingService[] = results
        .filter((c: any) => c.service === "REG" || c.service === "YES")
        .map((c: any) => {
          // Bersihkan format etd (misal mengganti "day" dengan "hari")
          let etdClean = c.etd || "-";
          etdClean = etdClean.replace(/days?/gi, "hari").trim();

          return {
            service: c.service,
            name: `JNE ${c.service}`,
            description: c.description || "",
            cost: Number(c.cost),
            etd: etdClean,
          };
        });

      return {
        success: true,
        rates,
        originCity: origin.city_name,
        originProvince: origin.province,
        destCity: data.destinationKota,
        weightGrams,
        isMock: false,
      };
    } catch (err) {
      console.error(
        "[Shipping API] Gagal memanggil API RajaOngkir V2, menggunakan fallback offline:",
        err,
      );
      return {
        success: true,
        rates: calculateOfflineRates(
          data.destinationProvinsi,
          data.destinationKota,
          origin.city_name,
          weightGrams,
        ),
        originCity: origin.city_name,
        originProvince: origin.province,
        destCity: data.destinationKota,
        weightGrams,
        isMock: true,
      };
    }
  });

export const getStoreOrigin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const origin = await getAdminOrigin();
    return {
      success: true,
      city: origin.city_name,
      province: origin.province,
    };
  } catch (err) {
    console.error("Error getting store origin:", err);
    return {
      success: true,
      city: "Jakarta Selatan",
      province: "DKI Jakarta",
    };
  }
});
