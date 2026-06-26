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
  let matched = cities.find(c => {
    const cProvClean = cleanName(c.province);
    const cCityClean = cleanName(c.city_name);
    return cProvClean === targetProvClean && cCityClean === targetCityClean;
  });

  if (matched) return matched;

  // 2. Coba pencocokan parsial jika persis gagal (misal untuk menangani perbedaan penulisan provinsi)
  matched = cities.find(c => {
    const cProvClean = cleanName(c.province);
    const cCityClean = cleanName(c.city_name);
    return cProvClean.includes(targetProvClean) && cCityClean === targetCityClean;
  });

  return matched;
}

// Fungsi untuk mendapatkan kota asal dinamis dari profil Admin di Supabase
async function getAdminOrigin(): Promise<{ city_id: string; city_name: string; province: string }> {
  // Default fallback: Jakarta Selatan (153)
  const defaultOrigin = {
    city_id: "153",
    city_name: "Jakarta Selatan",
    province: "DKI Jakarta"
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
      console.warn("[Shipping API] Tidak ada user dengan role admin. Menggunakan origin default (Jakarta Selatan).");
      return defaultOrigin;
    }

    // 2. Ambil profil user tersebut (kota & provinsi)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("kota, provinsi")
      .eq("id", userRole.user_id)
      .maybeSingle();

    if (profileError || !profile || !profile.kota) {
      console.warn("[Shipping API] Profil admin tidak ditemukan atau kolom kota kosong. Menggunakan origin default.");
      return defaultOrigin;
    }

    // 3. Cocokkan kota admin ke RajaOngkir ID
    const matchedCity = findRajaOngkirCity(profile.provinsi || "", profile.kota);
    if (!matchedCity) {
      console.warn(`[Shipping API] Kota admin "${profile.kota}" tidak cocok dengan data RajaOngkir. Menggunakan origin default.`);
      return defaultOrigin;
    }

    console.log(`[Shipping API] Kota asal admin berhasil dideteksi secara dinamis: ${matchedCity.city_name} (ID: ${matchedCity.city_id})`);
    return {
      city_id: matchedCity.city_id,
      city_name: matchedCity.city_name,
      province: matchedCity.province
    };
  } catch (err) {
    console.error("[Shipping API] Error saat mendapatkan kota asal admin:", err);
    return defaultOrigin;
  }
}

// Skema input untuk menghitung ongkir
const calculateShippingRatesInput = z.object({
  destinationProvinsi: z.string().min(1),
  destinationKota: z.string().min(1),
  totalQuantity: z.number().int().positive()
});

export interface ShippingService {
  service: string;      // REG, YES, OKE
  name: string;         // JNE REG, JNE YES, JNE OKE
  description: string;  // Layanan Reguler, dsb.
  cost: number;
  etd: string;          // 1-2 hari
}

// Hitung ongkir fallback offline berdasarkan zona provinsi dan berat
function calculateOfflineRates(
  destProvince: string,
  weightGrams: number
): ShippingService[] {
  const p = destProvince.toLowerCase();
  let baseRatePerKg = 15000; // Default fallback umum

  if (p.includes("jakarta")) {
    baseRatePerKg = 9000;
  } else if (p.includes("banten") || (p.includes("jawa") && p.includes("barat"))) {
    baseRatePerKg = 11000;
  } else if (p.includes("tengah") || p.includes("yogyakarta") || p.includes("timur")) {
    baseRatePerKg = 16000;
  } else if (p.includes("bali")) {
    baseRatePerKg = 22000;
  } else if (
    p.includes("sumatera") || p.includes("aceh") || p.includes("riau") ||
    p.includes("jambi") || p.includes("bengkulu") || p.includes("lampung") ||
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
      etd: "1-3 hari"
    },
    {
      service: "YES",
      name: "JNE YES",
      description: "Yakin Esok Sampai",
      cost: costYes,
      etd: "1 hari"
    },
    {
      service: "OKE",
      name: "JNE OKE",
      description: "Ongkos Kirim Ekonomis",
      cost: costOke,
      etd: "2-5 hari"
    }
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

    // 2. Cocokkan kota tujuan (Pelanggan)
    const destination = findRajaOngkirCity(data.destinationProvinsi, data.destinationKota);

    if (!destination) {
      console.warn(`[Shipping API] Kota tujuan "${data.destinationKota}" tidak dapat dicocokkan dengan RajaOngkir ID.`);
      // Jika tidak cocok, berikan estimasi offline agar tidak error
      return {
        success: true,
        rates: calculateOfflineRates(data.destinationProvinsi, weightGrams),
        originCity: origin.city_name,
        destCity: data.destinationKota,
        weightGrams,
        isMock: true
      };
    }

    // Jika API Key tidak diset, gunakan simulasi offline
    if (!apiKey) {
      console.warn("[Shipping API] RAJAONGKIR_API_KEY tidak dikonfigurasi. Menggunakan kalkulasi tarif simulasi.");
      return {
        success: true,
        rates: calculateOfflineRates(data.destinationProvinsi, weightGrams),
        originCity: origin.city_name,
        destCity: destination.city_name,
        weightGrams,
        isMock: true
      };
    }

    try {
      console.log(`[Shipping API] Mengambil ongkir real-time dari ${origin.city_name} (ID: ${origin.city_id}) ke ${destination.city_name} (ID: ${destination.city_id}) dengan berat ${weightGrams} gram`);

      // Buat URLSearchParams untuk request form URL encoded
      const bodyParams = new URLSearchParams();
      bodyParams.append("origin", origin.city_id);
      bodyParams.append("destination", destination.city_id);
      bodyParams.append("weight", weightGrams.toString());
      bodyParams.append("courier", "jne");

      const response = await fetch("https://api.rajaongkir.com/starter/cost", {
        method: "POST",
        headers: {
          "key": apiKey,
          "content-type": "application/x-www-form-urlencoded"
        },
        body: bodyParams.toString()
      });

      if (!response.ok) {
        throw new Error(`RajaOngkir API returned status ${response.status}`);
      }

      const resJson = await response.json();
      const results = resJson.rajaongkir?.results?.[0];

      if (!results || !results.costs || results.costs.length === 0) {
        throw new Error("Respons RajaOngkir kosong atau tidak memiliki data tarif.");
      }

      // Map hasil dari RajaOngkir ke format kita
      const rates: ShippingService[] = results.costs.map((c: any) => {
        const costDetail = c.cost?.[0] || { value: 0, etd: "-" };
        
        // Bersihkan format etd (misal "1-2" menjadi "1-2 hari", "1" menjadi "1 hari")
        let etdClean = costDetail.etd || "-";
        if (etdClean !== "-" && !etdClean.toLowerCase().includes("hari")) {
          etdClean = `${etdClean} hari`;
        }

        return {
          service: c.service,
          name: `JNE ${c.service}`,
          description: c.description || "",
          cost: Number(costDetail.value),
          etd: etdClean
        };
      });

      return {
        success: true,
        rates,
        originCity: origin.city_name,
        originProvince: origin.province,
        destCity: destination.city_name,
        weightGrams,
        isMock: false
      };

    } catch (err) {
      console.error("[Shipping API] Gagal memanggil API RajaOngkir, menggunakan fallback offline:", err);
      return {
        success: true,
        rates: calculateOfflineRates(data.destinationProvinsi, weightGrams),
        originCity: origin.city_name,
        originProvince: origin.province,
        destCity: destination.city_name,
        weightGrams,
        isMock: true
      };
    }
  });

export const getStoreOrigin = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const origin = await getAdminOrigin();
    return {
      success: true,
      city: origin.city_name,
      province: origin.province
    };
  } catch (err) {
    console.error("Error getting store origin:", err);
    return {
      success: true,
      city: "Jakarta Selatan",
      province: "DKI Jakarta"
    };
  }
});
