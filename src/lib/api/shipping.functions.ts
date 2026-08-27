import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  // Default fallback: Kota Cimahi (107) - Alamat Toko AA Jersey
  const defaultOrigin = {
    city_id: "107",
    city_name: "Kota Cimahi",
    province: "Jawa Barat",
    kecamatan: "Cimahi Tengah",
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
        "[Shipping API] Tidak ada user dengan role admin. Menggunakan origin default (Kota Cimahi).",
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

    const resolvedCityName =
      profile.kota || (matchedCity ? `${matchedCity.type} ${matchedCity.city_name}` : "Kota Cimahi");
    const resolvedProvince = profile.provinsi || matchedCity?.province || "Jawa Barat";

    console.log(
      `[Shipping API] Kota asal admin berhasil dideteksi secara dinamis dari Pengaturan Toko: ${resolvedCityName}, ${resolvedProvince} (Kecamatan: ${kecamatan || "Cimahi Tengah"})`,
    );

    return {
      city_id: matchedCity?.city_id || "107",
      city_name: resolvedCityName,
      province: resolvedProvince,
      kecamatan: kecamatan || "Cimahi Tengah",
    };
  } catch (err) {
    console.error("[Shipping API] Error saat mendapatkan kota asal admin:", err);
    return defaultOrigin;
  }
}

// Helper untuk membersihkan kata kunci pencarian RajaOngkir dari prefix administratif
function cleanRajaOngkirKeyword(str: string): string {
  if (!str) return "";
  return str
    .replace(/\b(kabupaten|kota|kab|kecamatan|kec|kelurahan|kel|desa)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper untuk mencari ID V2 RajaOngkir dengan verifikasi kecocokan wilayah
async function searchRajaOngkirV2Destination(
  rawKeyword: string,
  apiKey: string,
  expectedCity?: string,
  expectedProvince?: string,
): Promise<number | null> {
  try {
    const cleanedKeyword = cleanRajaOngkirKeyword(rawKeyword);
    const searchQuery = cleanedKeyword || rawKeyword;
    const url = `https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${encodeURIComponent(searchQuery)}&limit=10`;
    
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
    const list = resJson.data;

    if (!list || !Array.isArray(list) || list.length === 0) {
      return null;
    }

    // Jika ada expectedCity / expectedProvince, cari item yang paling cocok
    if (expectedCity) {
      const cleanExpCity = cleanRajaOngkirKeyword(expectedCity).toLowerCase();
      const cleanExpProv = expectedProvince ? cleanRajaOngkirKeyword(expectedProvince).toLowerCase() : "";

      const bestMatch = list.find((d: any) => {
        const dCity = cleanRajaOngkirKeyword(d.city_name || "").toLowerCase();
        const dProv = cleanRajaOngkirKeyword(d.province_name || "").toLowerCase();
        
        const cityOk = dCity.includes(cleanExpCity) || cleanExpCity.includes(dCity);
        const provOk = !cleanExpProv || dProv.includes(cleanExpProv) || cleanExpProv.includes(dProv);
        return cityOk && provOk;
      });

      if (bestMatch) {
        return bestMatch.id;
      }
    }

    // Default: kembalikan hasil pertama
    return list[0].id;
  } catch (err) {
    console.error(`[Shipping API] Error in searchRajaOngkirV2Destination for "${rawKeyword}":`, err);
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
  etd: string;
  courier?: string;
}

interface RajaOngkirRate {
  service: string;
  description?: string;
  cost: string | number;
  etd?: string;
}

// Hitung ongkir fallback offline berdasarkan kota asal/tujuan, zona provinsi, dan berat
function calculateOfflineRates(
  destProvinsi: string,
  destKota: string,
  originKota: string,
  weightGrams: number,
): ShippingService[] {
  const p = destProvinsi.toLowerCase();
  let baseRatePerKg = 12000;

  if (
    destKota.toLowerCase().includes(originKota.toLowerCase()) ||
    originKota.toLowerCase().includes(destKota.toLowerCase())
  ) {
    baseRatePerKg = 9000;
  } else if (p.includes("jakarta") || p.includes("dki")) {
    baseRatePerKg = 10000;
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
  const costYes = (baseRatePerKg + 9000) * kg;

  return [
    {
      service: "JNE REG",
      name: "JNE REG",
      description: "Layanan Reguler JNE",
      cost: costReg,
      etd: "1-3 hari",
      courier: "jne",
    },
    {
      service: "J&T EZ",
      name: "J&T EZ",
      description: "Layanan Reguler J&T Express",
      cost: costReg,
      etd: "1-3 hari",
      courier: "jnt",
    },
    {
      service: "Lion Parcel REGPACK",
      name: "Lion Parcel REGPACK",
      description: "Layanan Reguler Lion Parcel",
      cost: Math.round(costReg * 0.95),
      etd: "2-4 hari",
      courier: "lion",
    },
    {
      service: "JNE YES",
      name: "JNE YES",
      description: "Yakin Esok Sampai (Next Day)",
      cost: costYes,
      etd: "1 hari",
      courier: "jne",
    },
  ];
}

interface RajaOngkirRate {
  service: string;
  description?: string;
  cost: string | number;
  etd?: string;
}

// Server function untuk menghitung tarif pengiriman multi-kurir (JNE, J&T, Lion Parcel)
export const calculateShippingRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(calculateShippingRatesInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.RAJAONGKIR_API_KEY;

    // Estimasi berat jersey: 250 gram per pcs
    const weightGrams = data.totalQuantity * 250;

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
      originV2Id = await searchRajaOngkirV2Destination(
        originKeyword,
        apiKey,
        origin.city_name,
        origin.province,
      );
      if (!originV2Id && origin.kecamatan) {
        originV2Id = await searchRajaOngkirV2Destination(
          origin.city_name,
          apiKey,
          origin.city_name,
          origin.province,
        );
      }

      // Cari destination V2 ID
      const destKeyword = data.destinationKecamatan
        ? `${data.destinationKecamatan} ${data.destinationKota}`
        : data.destinationKota;
      destV2Id = await searchRajaOngkirV2Destination(
        destKeyword,
        apiKey,
        data.destinationKota,
        data.destinationProvinsi,
      );
      if (!destV2Id && data.destinationKecamatan) {
        destV2Id = await searchRajaOngkirV2Destination(
          data.destinationKota,
          apiKey,
          data.destinationKota,
          data.destinationProvinsi,
        );
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
        `[Shipping API] Mengambil ongkir real-time V2 dari ${origin.city_name} (ID: ${originV2Id}) ke ${data.destinationKota} (ID: ${destV2Id}) [${weightGrams}g]`,
      );

      // Panggil API RajaOngkir V2 untuk JNE, J&T, dan Lion Parcel secara paralel
      const couriersToFetch = ["jne", "jnt", "lion"];
      const fetchCourier = async (c: string) => {
        const bodyParams = new URLSearchParams();
        bodyParams.append("origin", originV2Id!.toString());
        bodyParams.append("destination", destV2Id!.toString());
        bodyParams.append("weight", weightGrams.toString());
        bodyParams.append("courier", c);

        const res = await fetch("https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost", {
          method: "POST",
          headers: {
            key: apiKey,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: bodyParams.toString(),
        });
        if (!res.ok) return [];
        const json = await res.json();
        return (json.data || []) as RajaOngkirRate[];
      };

      const [jneResults, jntResults, lionResults] = await Promise.all([
        fetchCourier("jne"),
        fetchCourier("jnt"),
        fetchCourier("lion"),
      ]);

      const rates: ShippingService[] = [];

      // 1. JNE REG (Reguler)
      const jneReg = jneResults.find((r) => r.service === "REG");
      if (jneReg) {
        rates.push({
          service: "JNE REG",
          name: "JNE REG",
          description: "Layanan Reguler JNE",
          cost: Number(jneReg.cost),
          etd: (jneReg.etd || "1-3 hari").replace(/days?/gi, "hari").trim(),
          courier: "jne",
        });
      }

      // 2. J&T EZ (Reguler)
      const jntEz = jntResults.find(
        (r) => r.service === "EZ" || r.service.toLowerCase().includes("ez") || r.service === "REG",
      );
      if (jntEz) {
        rates.push({
          service: "J&T EZ",
          name: "J&T EZ",
          description: "Layanan Reguler J&T Express",
          cost: Number(jntEz.cost),
          etd: (jntEz.etd || "1-3 hari").replace(/days?/gi, "hari").trim(),
          courier: "jnt",
        });
      }

      // 3. Lion Parcel REGPACK (Reguler)
      const lionReg = lionResults.find(
        (r) =>
          r.service === "REGPACK" ||
          r.service.toLowerCase().includes("reg") ||
          r.service === "ONEPACK",
      );
      if (lionReg) {
        rates.push({
          service: "Lion Parcel REGPACK",
          name: "Lion Parcel REGPACK",
          description: "Layanan Reguler Lion Parcel",
          cost: Number(lionReg.cost),
          etd: (lionReg.etd || "2-4 hari").replace(/days?/gi, "hari").trim(),
          courier: "lion",
        });
      }

      // 4. JNE YES (Next Day)
      const jneYes = jneResults.find((r) => r.service === "YES");
      if (jneYes) {
        rates.push({
          service: "JNE YES",
          name: "JNE YES",
          description: "Yakin Esok Sampai (Next Day)",
          cost: Number(jneYes.cost),
          etd: (jneYes.etd || "1 hari").replace(/days?/gi, "hari").trim(),
          courier: "jne",
        });
      }

      // Jika salah satu kurir kosong karena coverage, pastikan minimal ada tarif
      if (rates.length === 0) {
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
        "[Shipping API] Gagal memanggil API RajaOngkir V2 multi-kurir, menggunakan fallback offline:",
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

// Schema input untuk Lacak Resi (Waybill Tracking)
const trackWaybillInput = z.object({
  awb: z.string(),
  courier: z.string(),
});

// Server function untuk Lacak Resi Otomatis (Waybill Tracking)
export const trackWaybill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(trackWaybillInput)
  .handler(async ({ data }) => {
    const apiKey = process.env.RAJAONGKIR_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message: "API Key RajaOngkir belum dikonfigurasi.",
      };
    }

    try {
      const bodyParams = new URLSearchParams();
      bodyParams.append("awb", data.awb.trim());
      bodyParams.append("courier", data.courier.toLowerCase());

      const res = await fetch("https://rajaongkir.komerce.id/api/v1/track/waybill", {
        method: "POST",
        headers: {
          key: apiKey,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: bodyParams.toString(),
      });

      const json = await res.json();
      if (res.ok && json.meta?.status === "success" && json.data) {
        return {
          success: true,
          data: json.data,
        };
      }

      return {
        success: false,
        message: json.meta?.message || "Nomor resi tidak ditemukan atau belum aktif di ekspedisi.",
      };
    } catch (err: any) {
      console.error("[Tracking API Error]:", err);
      return {
        success: false,
        message: err.message || "Gagal menghubungi server pelacakan resi.",
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
      kecamatan: origin.kecamatan,
    };
  } catch (err) {
    console.error("Error getting store origin:", err);
    return {
      success: true,
      city: "Kota Cimahi",
      province: "Jawa Barat",
      kecamatan: "Cimahi Tengah",
    };
  }
});

export const getPublicStoreInfo = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (userRole) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("nama_lengkap, no_hp, kota, provinsi, alamat")
        .eq("id", userRole.user_id)
        .maybeSingle();

      if (profile) {
        return {
          storeName: profile.nama_lengkap || "AA Jersey",
          noHp: profile.no_hp || "0895-8088-60080",
          kota: profile.kota || "Kota Cimahi",
          provinsi: profile.provinsi || "Jawa Barat",
        };
      }
    }
  } catch (err) {
    console.error("Error fetching public store info:", err);
  }

  return {
    storeName: "AA Jersey",
    noHp: "0895-8088-60080",
    kota: "Kota Cimahi",
    provinsi: "Jawa Barat",
  };
});
