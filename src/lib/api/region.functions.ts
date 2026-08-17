import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

interface RegionItem {
  id: string;
  name: string;
}

// In-memory cache on server
const cache = new Map<string, any>();

// Built-in list of all 38 Indonesian Provinces
const STATIC_PROVINCES: RegionItem[] = [
  { id: "11", name: "Aceh" },
  { id: "12", name: "Sumatera Utara" },
  { id: "13", name: "Sumatera Barat" },
  { id: "14", name: "Riau" },
  { id: "15", name: "Jambi" },
  { id: "16", name: "Sumatera Selatan" },
  { id: "17", name: "Bengkulu" },
  { id: "18", name: "Lampung" },
  { id: "19", name: "Kepulauan Bangka Belitung" },
  { id: "21", name: "Kepulauan Riau" },
  { id: "31", name: "DKI Jakarta" },
  { id: "32", name: "Jawa Barat" },
  { id: "33", name: "Jawa Tengah" },
  { id: "34", name: "DI Yogyakarta" },
  { id: "35", name: "Jawa Timur" },
  { id: "36", name: "Banten" },
  { id: "51", name: "Bali" },
  { id: "52", name: "Nusa Tenggara Barat" },
  { id: "53", name: "Nusa Tenggara Timur" },
  { id: "61", name: "Kalimantan Barat" },
  { id: "62", name: "Kalimantan Tengah" },
  { id: "63", name: "Kalimantan Selatan" },
  { id: "64", name: "Kalimantan Timur" },
  { id: "65", name: "Kalimantan Utara" },
  { id: "71", name: "Sulawesi Utara" },
  { id: "72", name: "Sulawesi Tengah" },
  { id: "73", name: "Sulawesi Selatan" },
  { id: "74", name: "Sulawesi Tenggara" },
  { id: "75", name: "Gorontalo" },
  { id: "76", name: "Sulawesi Barat" },
  { id: "81", name: "Maluku" },
  { id: "82", name: "Maluku Utara" },
  { id: "91", name: "Papua Barat" },
  { id: "92", name: "Papua" },
  { id: "93", name: "Papua Selatan" },
  { id: "94", name: "Papua Tengah" },
  { id: "95", name: "Papua Pegunungan" },
  { id: "96", name: "Papua Barat Daya" },
];

export const getProvinces = createServerFn({ method: "GET" }).handler(async () => {
  if (cache.has("provinces")) {
    return cache.get("provinces") as RegionItem[];
  }

  try {
    const res = await fetch("https://wilayah.id/api/provinces.json", {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.ok) {
      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data : json;
      if (Array.isArray(items) && items.length > 0) {
        const result = items.map((p: any) => ({ id: String(p.code || p.id), name: p.name }));
        cache.set("provinces", result);
        return result;
      }
    }
  } catch (e) {
    console.warn("Failed fetching from wilayah.id, using fallback", e);
  }

  cache.set("provinces", STATIC_PROVINCES);
  return STATIC_PROVINCES;
});

const getRegenciesSchema = z.object({
  provCode: z.string(),
});

export const getRegencies = createServerFn({ method: "POST" })
  .validator(getRegenciesSchema)
  .handler(async ({ data }) => {
    const key = `reg_${data.provCode}`;
    if (cache.has(key)) {
      return cache.get(key) as RegionItem[];
    }

    try {
      const res = await fetch(`https://wilayah.id/api/regencies/${data.provCode}.json`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.data) ? json.data : json;
        if (Array.isArray(items) && items.length > 0) {
          const result = items.map((r: any) => ({ id: String(r.code || r.id), name: r.name }));
          cache.set(key, result);
          return result;
        }
      }
    } catch (e) {
      console.warn("Failed fetching regencies from wilayah.id:", e);
    }

    // Fallback: emsifa
    try {
      const res2 = await fetch(
        `https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/regencies/${data.provCode}.json`,
      );
      if (res2.ok) {
        const data2 = await res2.json();
        const result = data2.map((r: any) => ({ id: String(r.id), name: r.name }));
        cache.set(key, result);
        return result;
      }
    } catch (e2) {
      console.error("Fallback regencies failed:", e2);
    }

    return [];
  });

const getDistrictsSchema = z.object({
  regCode: z.string(),
});

export const getDistricts = createServerFn({ method: "POST" })
  .validator(getDistrictsSchema)
  .handler(async ({ data }) => {
    const key = `dist_${data.regCode}`;
    if (cache.has(key)) {
      return cache.get(key) as RegionItem[];
    }

    try {
      const res = await fetch(`https://wilayah.id/api/districts/${data.regCode}.json`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.data) ? json.data : json;
        if (Array.isArray(items) && items.length > 0) {
          const result = items.map((d: any) => ({ id: String(d.code || d.id), name: d.name }));
          cache.set(key, result);
          return result;
        }
      }
    } catch (e) {
      console.warn("Failed fetching districts from wilayah.id:", e);
    }

    // Fallback: emsifa
    try {
      const cleanRegId = data.regCode.replace(".", "");
      const res2 = await fetch(
        `https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/districts/${cleanRegId}.json`,
      );
      if (res2.ok) {
        const data2 = await res2.json();
        const result = data2.map((d: any) => ({ id: String(d.id), name: d.name }));
        cache.set(key, result);
        return result;
      }
    } catch (e2) {
      console.error("Fallback districts failed:", e2);
    }

    return [];
  });

const getVillagesSchema = z.object({
  distCode: z.string(),
});

export const getVillages = createServerFn({ method: "POST" })
  .validator(getVillagesSchema)
  .handler(async ({ data }) => {
    const key = `vil_${data.distCode}`;
    if (cache.has(key)) {
      return cache.get(key) as RegionItem[];
    }

    try {
      const res = await fetch(`https://wilayah.id/api/villages/${data.distCode}.json`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        const json = await res.json();
        const items = Array.isArray(json.data) ? json.data : json;
        if (Array.isArray(items) && items.length > 0) {
          const result = items.map((v: any) => ({ id: String(v.code || v.id), name: v.name }));
          cache.set(key, result);
          return result;
        }
      }
    } catch (e) {
      console.warn("Failed fetching villages from wilayah.id:", e);
    }

    // Fallback: emsifa
    try {
      const cleanDistId = data.distCode.replace(/\./g, "");
      const res2 = await fetch(
        `https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/villages/${cleanDistId}.json`,
      );
      if (res2.ok) {
        const data2 = await res2.json();
        const result = data2.map((v: any) => ({ id: String(v.id), name: v.name }));
        cache.set(key, result);
        return result;
      }
    } catch (e2) {
      console.error("Fallback villages failed:", e2);
    }

    return [];
  });

const getPostalCodeSchema = z.object({
  query: z.string(),
});

export const getPostalCode = createServerFn({ method: "POST" })
  .validator(getPostalCodeSchema)
  .handler(async ({ data }) => {
    const key = `post_${data.query.toLowerCase().trim()}`;
    if (cache.has(key)) {
      return cache.get(key) as string | null;
    }

    try {
      const res = await fetch(
        `https://kodepos.vercel.app/search/?q=${encodeURIComponent(data.query)}`,
        { headers: { "User-Agent": "Mozilla/5.0" } },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.statusCode === 200 && Array.isArray(json.data) && json.data.length > 0) {
          const code = String(json.data[0].code);
          cache.set(key, code);
          return code;
        }
      }
    } catch (e) {
      console.warn("Failed fetching postal code:", e);
    }

    return null;
  });
