import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/app/SearchableSelect";
import {
  getProvinces,
  getRegencies,
  getDistricts,
  getVillages,
  getPostalCode,
} from "@/lib/api/region.functions";

// Helper to convert ALL UPPERCASE API results to Title Case
function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, (m) => m.toUpperCase());
}

// Clean string comparison to strip prefixes like KOTA / KABUPATEN
function cleanString(str: string): string {
  return str
    .toUpperCase()
    .replace(/^(KOTA|KABUPATEN|KAB)\.?\s+/i, "")
    .trim();
}

function stringsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  return cleanString(a) === cleanString(b) || a.toUpperCase() === b.toUpperCase();
}

interface RegionItem {
  id: string;
  name: string;
}

// Built-in list of all 38 Indonesian Provinces as guaranteed instant fallback
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

export interface IndonesiaRegionSelectorProps {
  disabled?: boolean;
  provinsi: string;
  setProvinsi: (val: string) => void;
  kota: string;
  setKota: (val: string) => void;
  kecamatan: string;
  setKecamatan: (val: string) => void;
  kelurahan: string;
  setKelurahan: (val: string) => void;
  kodePos: string;
  setKodePos: (val: string) => void;
  alamatDetail: string;
  setAlamatDetail: (val: string) => void;
  required?: boolean;
}

export function IndonesiaRegionSelector({
  disabled = false,
  provinsi,
  setProvinsi,
  kota,
  setKota,
  kecamatan,
  setKecamatan,
  kelurahan,
  setKelurahan,
  kodePos,
  setKodePos,
  alamatDetail,
  setAlamatDetail,
  required = true,
}: IndonesiaRegionSelectorProps) {
  // Region lists
  const [provinces, setProvinces] = useState<RegionItem[]>(STATIC_PROVINCES);
  const [regencies, setRegencies] = useState<RegionItem[]>([]);
  const [districts, setDistricts] = useState<RegionItem[]>([]);
  const [villages, setVillages] = useState<RegionItem[]>([]);

  // Selected API Codes
  const [provCode, setProvCode] = useState<string>("");
  const [regCode, setRegCode] = useState<string>("");
  const [distCode, setDistCode] = useState<string>("");
  const [villageCode, setVillageCode] = useState<string>("");

  // Loading states
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [loadingPostal, setLoadingPostal] = useState(false);

  // 1. Fetch Provinces via Server Function
  useEffect(() => {
    async function loadProvinces() {
      setLoadingProvinces(true);
      try {
        const data = await getProvinces();
        if (data && data.length > 0) {
          setProvinces(data);
        }
      } catch (err) {
        console.warn("Using static provinces fallback:", err);
      } finally {
        setLoadingProvinces(false);
      }
    }
    loadProvinces();
  }, []);

  // 2. Cascade 1: Find Province code when initial provinsi value exists
  useEffect(() => {
    if (provinces.length > 0 && provinsi && !provCode) {
      const match = provinces.find((p) => stringsMatch(p.name, provinsi));
      if (match) {
        setProvCode(match.id);
      }
    }
  }, [provinces, provinsi, provCode]);

  // 3. Cascade 2: Fetch Regencies (Kota/Kabupaten) when provCode changes
  useEffect(() => {
    if (!provCode) {
      setRegencies([]);
      return;
    }

    async function loadRegencies() {
      setLoadingRegencies(true);
      try {
        const data = await getRegencies({ data: { provCode } });
        setRegencies(data ?? []);
      } catch (err) {
        console.error("Error loading regencies:", err);
        setRegencies([]);
      } finally {
        setLoadingRegencies(false);
      }
    }
    loadRegencies();
  }, [provCode]);

  // 4. Cascade 3: Match Regency code when initial kota value exists
  useEffect(() => {
    if (regencies.length > 0 && kota && !regCode) {
      const match = regencies.find((r) => stringsMatch(r.name, kota));
      if (match) {
        setRegCode(match.id);
      }
    }
  }, [regencies, kota, regCode]);

  // 5. Cascade 4: Fetch Districts (Kecamatan) when regCode changes
  useEffect(() => {
    if (!regCode) {
      setDistricts([]);
      return;
    }

    async function loadDistricts() {
      setLoadingDistricts(true);
      try {
        const data = await getDistricts({ data: { regCode } });
        setDistricts(data ?? []);
      } catch (err) {
        console.error("Error loading districts:", err);
        setDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    }
    loadDistricts();
  }, [regCode]);

  // 6. Cascade 5: Match District code when initial kecamatan value exists
  useEffect(() => {
    if (districts.length > 0 && kecamatan && !distCode) {
      const match = districts.find((d) => stringsMatch(d.name, kecamatan));
      if (match) {
        setDistCode(match.id);
      }
    }
  }, [districts, kecamatan, distCode]);

  // 7. Cascade 6: Fetch Villages (Kelurahan/Desa) when distCode changes
  useEffect(() => {
    if (!distCode) {
      setVillages([]);
      return;
    }

    async function loadVillages() {
      setLoadingVillages(true);
      try {
        const data = await getVillages({ data: { distCode } });
        setVillages(data ?? []);
      } catch (err) {
        console.error("Error loading villages:", err);
        setVillages([]);
      } finally {
        setLoadingVillages(false);
      }
    }
    loadVillages();
  }, [distCode]);

  // 8. Cascade 7: Match Village code when initial kelurahan value exists
  useEffect(() => {
    if (villages.length > 0 && kelurahan && !villageCode) {
      const match = villages.find((v) => stringsMatch(v.name, kelurahan));
      if (match) {
        setVillageCode(match.id);
      }
    }
  }, [villages, kelurahan, villageCode]);

  // 9. Auto-fetch Postal Code when Village or District is selected
  const fetchPostalCode = async (villageName: string, districtName: string, cityName: string) => {
    if (!villageName && !districtName) return;
    setLoadingPostal(true);
    try {
      const query = [villageName, districtName, cityName.replace(/^(KOTA|KABUPATEN|KAB)\.?\s+/i, "")]
        .filter(Boolean)
        .join(" ");

      const code = await getPostalCode({ data: { query } });
      if (code) {
        setKodePos(code);
      } else if (districtName) {
        const fallbackCode = await getPostalCode({ data: { query: districtName } });
        if (fallbackCode) {
          setKodePos(fallbackCode);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch postal code:", err);
    } finally {
      setLoadingPostal(false);
    }
  };

  // Handlers for Cascade Selection
  const onProvinceSelect = (id: string) => {
    setProvCode(id);
    const item = provinces.find((p) => p.id === id);
    setProvinsi(item ? toTitleCase(item.name) : "");

    // Reset subordinate selections
    setRegCode("");
    setKota("");
    setDistCode("");
    setKecamatan("");
    setVillageCode("");
    setVillages([]);
    setKelurahan("");
    setKodePos("");
  };

  const onRegencySelect = (id: string) => {
    setRegCode(id);
    const item = regencies.find((r) => r.id === id);
    setKota(item ? toTitleCase(item.name) : "");

    // Reset subordinate selections
    setDistCode("");
    setKecamatan("");
    setVillageCode("");
    setVillages([]);
    setKelurahan("");
    setKodePos("");
  };

  const onDistrictSelect = (id: string) => {
    setDistCode(id);
    const item = districts.find((d) => d.id === id);
    const distName = item ? toTitleCase(item.name) : "";
    setKecamatan(distName);

    // Reset subordinate selections
    setVillageCode("");
    setVillages([]);
    setKelurahan("");
    setKodePos("");

    // Try finding postal code by district immediately
    if (distName) {
      fetchPostalCode("", distName, kota);
    }
  };

  const onVillageSelect = (id: string) => {
    setVillageCode(id);
    const item = villages.find((v) => v.id === id);
    const vName = item ? toTitleCase(item.name) : "";
    setKelurahan(vName);

    // Fetch accurate postal code for this specific village
    if (vName) {
      fetchPostalCode(vName, kecamatan, kota);
    }
  };

  return (
    <div className="sm:col-span-2 grid grid-cols-1 gap-4 w-full">
      {/* Row 1: Provinsi & Kota/Kabupaten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <div>
          <Label htmlFor="indonesia-province" className="flex items-center gap-1.5 h-5 mb-1.5">
            Provinsi {required && <span className="text-destructive">*</span>}
          </Label>
          <SearchableSelect
            id="indonesia-province"
            options={provinces.map((p) => ({ value: p.id, label: toTitleCase(p.name) }))}
            value={provCode}
            onChange={onProvinceSelect}
            placeholder="Pilih Provinsi"
            searchPlaceholder="Cari Provinsi..."
            disabled={disabled}
            loading={loadingProvinces}
          />
        </div>

        <div>
          <Label htmlFor="indonesia-regency" className="flex items-center gap-1.5 h-5 mb-1.5">
            Kota/Kabupaten {required && <span className="text-destructive">*</span>}
          </Label>
          <SearchableSelect
            id="indonesia-regency"
            options={regencies.map((r) => ({ value: r.id, label: toTitleCase(r.name) }))}
            value={regCode}
            onChange={onRegencySelect}
            placeholder={!provCode ? "Pilih Provinsi terlebih dahulu" : "Pilih Kota/Kabupaten"}
            searchPlaceholder="Cari Kota/Kabupaten..."
            disabled={disabled || !provCode}
            loading={loadingRegencies}
          />
        </div>
      </div>

      {/* Row 2: Kecamatan, Desa/Kelurahan, & Kode Pos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <div>
          <Label htmlFor="indonesia-district" className="flex items-center gap-1.5 h-5 mb-1.5">
            Kecamatan {required && <span className="text-destructive">*</span>}
          </Label>
          <SearchableSelect
            id="indonesia-district"
            options={districts.map((d) => ({ value: d.id, label: toTitleCase(d.name) }))}
            value={distCode}
            onChange={onDistrictSelect}
            placeholder={!regCode ? "Pilih Kota terlebih dahulu" : "Pilih Kecamatan"}
            searchPlaceholder="Cari Kecamatan..."
            disabled={disabled || !regCode}
            loading={loadingDistricts}
          />
        </div>

        <div>
          <Label htmlFor="indonesia-village" className="flex items-center gap-1.5 h-5 mb-1.5">
            Desa / Kelurahan {required && <span className="text-destructive">*</span>}
          </Label>
          <SearchableSelect
            id="indonesia-village"
            options={villages.map((v) => ({ value: v.id, label: toTitleCase(v.name) }))}
            value={villageCode}
            onChange={onVillageSelect}
            placeholder={!distCode ? "Pilih Kecamatan dahulu" : "Pilih Desa/Kelurahan"}
            searchPlaceholder="Cari Desa / Kelurahan..."
            disabled={disabled || !distCode}
            loading={loadingVillages}
          />
        </div>

        <div>
          <Label htmlFor="indonesia-zip-input" className="flex items-center gap-1.5 h-5 mb-1.5">
            Kode Pos {required && <span className="text-destructive">*</span>}
            {loadingPostal && (
              <span className="text-[11px] text-primary animate-pulse">(Mencari...)</span>
            )}
          </Label>
          <Input
            id="indonesia-zip-input"
            required={required}
            disabled={disabled}
            placeholder="Contoh: 43192"
            value={kodePos}
            onChange={(e) => setKodePos(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      {/* Row 3: Detail Alamat Lengkap */}
      <div>
        <Label htmlFor="indonesia-street" className="flex items-center gap-1.5 h-5 mb-1.5">
          Alamat Lengkap (Jalan, No. Rumah, RT/RW, Patokan){" "}
          {required && <span className="text-destructive">*</span>}
        </Label>
        <Textarea
          id="indonesia-street"
          required={required}
          disabled={disabled}
          placeholder="Tuliskan nama jalan, blok, nomor rumah, RT/RW, dan patokan lengkap"
          value={alamatDetail}
          onChange={(e) => setAlamatDetail(e.target.value)}
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}

