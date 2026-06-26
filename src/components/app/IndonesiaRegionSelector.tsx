import { useEffect, useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/app/SearchableSelect";

// Helper to convert ALL UPPERCASE API results to beautiful Title Case
export function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (m) => m.toUpperCase());
}

// Helper to parse detailed address column into street address, district, and village
export function parseAlamat(alamatStr: string) {
  if (!alamatStr) return { street: "", kecamatan: "", kelurahan: "" };

  const matchKecKel = alamatStr.match(/(.*?),\s*Kec\.\s*([^,]+),\s*Kel\.\s*([^,]+)$/i);
  if (matchKecKel) {
    return {
      street: matchKecKel[1].trim(),
      kecamatan: matchKecKel[2].trim(),
      kelurahan: matchKecKel[3].trim(),
    };
  }

  const matchKelKec = alamatStr.match(/(.*?),\s*Kel\.\s*([^,]+),\s*Kec\.\s*([^,]+)$/i);
  if (matchKelKec) {
    return {
      street: matchKelKec[1].trim(),
      kelurahan: matchKelKec[2].trim(),
      kecamatan: matchKelKec[3].trim(),
    };
  }

  return {
    street: alamatStr,
    kecamatan: "",
    kelurahan: "",
  };
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

interface ApiItem {
  id: string;
  name: string;
}

interface PostalItem {
  code: number | string;
  village: string;
  district: string;
  regency: string;
  province: string;
}

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
  const [provinces, setProvinces] = useState<ApiItem[]>([]);
  const [regencies, setRegencies] = useState<ApiItem[]>([]);
  const [districts, setDistricts] = useState<ApiItem[]>([]);
  const [villages, setVillages] = useState<PostalItem[]>([]);

  // Selected API IDs
  const [provId, setProvId] = useState<string>("");
  const [regId, setRegId] = useState<string>("");
  const [distId, setDistId] = useState<string>("");

  // Loading states
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);

  // Fallback state if postal code API fails
  const [fallbackMode, setFallbackMode] = useState(false);

  // Prevent infinite update loops during initial cascading load
  const isInitializing = useRef(false);

  // Load provinces on mount
  useEffect(() => {
    async function loadProvinces() {
      setLoadingProvinces(true);
      try {
        const res = await fetch("https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/provinces.json");
        if (!res.ok) throw new Error("Failed to fetch provinces");
        const data: ApiItem[] = await res.json();
        setProvinces(data);
      } catch (err) {
        console.error("Error loading provinces:", err);
      } finally {
        setLoadingProvinces(false);
      }
    }
    loadProvinces();
  }, []);

  // Cascade 1: Find Prov ID from Provinsi name (for initial values loaded from DB)
  useEffect(() => {
    if (provinces.length > 0 && provinsi && !provId) {
      const match = provinces.find((p) => stringsMatch(p.name, provinsi));
      if (match) {
        setProvId(match.id);
      }
    }
  }, [provinces, provinsi, provId]);

  // Cascade 2: Fetch Regencies when provId changes
  useEffect(() => {
    if (!provId) {
      setRegencies([]);
      return;
    }
    async function loadRegencies() {
      setLoadingRegencies(true);
      try {
        const res = await fetch(`https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/regencies/${provId}.json`);
        if (!res.ok) throw new Error("Failed to fetch regencies");
        const data: ApiItem[] = await res.json();
        setRegencies(data);
      } catch (err) {
        console.error("Error loading regencies:", err);
      } finally {
        setLoadingRegencies(false);
      }
    }
    loadRegencies();
  }, [provId]);

  // Cascade 3: Find Regency ID from Kota name
  useEffect(() => {
    if (regencies.length > 0 && kota && !regId) {
      const match = regencies.find((r) => stringsMatch(r.name, kota));
      if (match) {
        setRegId(match.id);
      }
    }
  }, [regencies, kota, regId]);

  // Cascade 4: Fetch Districts when regId changes
  useEffect(() => {
    if (!regId) {
      setDistricts([]);
      return;
    }
    async function loadDistricts() {
      setLoadingDistricts(true);
      try {
        const res = await fetch(`https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api/districts/${regId}.json`);
        if (!res.ok) throw new Error("Failed to fetch districts");
        const data: ApiItem[] = await res.json();
        setDistricts(data);
      } catch (err) {
        console.error("Error loading districts:", err);
      } finally {
        setLoadingDistricts(false);
      }
    }
    loadDistricts();
  }, [regId]);

  // Cascade 5: Find District ID from Kecamatan name
  useEffect(() => {
    if (districts.length > 0 && kecamatan && !distId) {
      const match = districts.find((d) => stringsMatch(d.name, kecamatan));
      if (match) {
        setDistId(match.id);
      }
    }
  }, [districts, kecamatan, distId]);

  // Cascade 6: Fetch Villages and Postal codes from Vercel API based on district (Kecamatan) name + city name
  useEffect(() => {
    if (!kecamatan) {
      setVillages([]);
      return;
    }

    async function loadVillagesAndPostalCodes() {
      setLoadingVillages(true);
      setFallbackMode(false);
      try {
        // Bersihkan prefiks kota/kabupaten agar pencarian lebih spesifik
        const cleanKota = kota.replace(/^(KOTA|KABUPATEN|KAB)\.?\s+/i, "").trim();
        const searchQuery = `${kecamatan} ${cleanKota}`;

        const res = await fetch(`https://kodepos.vercel.app/search/?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) throw new Error("Failed to fetch postal codes");
        const json = await res.json();
        if (json.statusCode === 200 && Array.isArray(json.data)) {
          // Filter results matching the active city and province to avoid collisions
          const filtered: PostalItem[] = json.data.filter((item: PostalItem) => {
            return (
              (!provinsi || stringsMatch(item.province, provinsi)) &&
              (!kota || stringsMatch(item.regency, kota))
            );
          });
          
          const finalData = filtered.length > 0 ? filtered : json.data;
          setVillages(finalData);

          if (finalData.length === 0) {
            setFallbackMode(true);
          }
        } else {
          setFallbackMode(true);
        }
      } catch (err) {
        console.error("Error loading postal codes:", err);
        setFallbackMode(true); // Fallback to manual text inputs if API fails
      } finally {
        setLoadingVillages(false);
      }
    }

    loadVillagesAndPostalCodes();
  }, [kecamatan, kota, provinsi]);

  // Handle Province Selection
  const onProvinceSelect = (id: string) => {
    setProvId(id);
    const item = provinces.find((p) => p.id === id);
    setProvinsi(item ? toTitleCase(item.name) : "");

    // Reset subordinate selections
    setRegId("");
    setKota("");
    setDistId("");
    setKecamatan("");
    setVillages([]);
    setKelurahan("");
    setKodePos("");
  };

  // Handle City/Regency Selection
  const onRegencySelect = (id: string) => {
    setRegId(id);
    const item = regencies.find((r) => r.id === id);
    setKota(item ? toTitleCase(item.name) : "");

    // Reset subordinate selections
    setDistId("");
    setKecamatan("");
    setVillages([]);
    setKelurahan("");
    setKodePos("");
  };

  // Handle District/Kecamatan Selection
  const onDistrictSelect = (id: string) => {
    setDistId(id);
    const item = districts.find((d) => d.id === id);
    setKecamatan(item ? toTitleCase(item.name) : "");

    // Reset subordinate selections
    setVillages([]);
    setKelurahan("");
    setKodePos("");
  };

  // Handle Village/Kelurahan Selection
  const onVillageSelect = (val: string) => {
    if (!val) {
      setKelurahan("");
      setKodePos("");
      return;
    }
    const [villageName, zip] = val.split("|");
    setKelurahan(villageName);
    setKodePos(zip);
  };

  return (
    <div className="space-y-4 sm:col-span-2 grid grid-cols-1 gap-4">
      {/* Row 1: Provinsi & Kota/Kabupaten (2 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Provinsi select */}
        <div>
          <Label htmlFor="indonesia-province" className="flex items-center gap-1.5 h-5 mb-1.5">
            Provinsi {required && <span className="text-destructive">*</span>}
            {loadingProvinces && <span className="text-xs text-muted-foreground animate-pulse">(Memuat...)</span>}
          </Label>
          <SearchableSelect
            options={provinces.map((p) => ({ value: p.id, label: toTitleCase(p.name) }))}
            value={provId}
            onChange={onProvinceSelect}
            placeholder="Pilih Provinsi"
            searchPlaceholder="Cari Provinsi..."
            disabled={disabled || loadingProvinces}
          />
        </div>

        {/* Kota/Kabupaten select */}
        <div>
          <Label htmlFor="indonesia-regency" className="flex items-center gap-1.5 h-5 mb-1.5">
            Kota/Kabupaten {required && <span className="text-destructive">*</span>}
            {loadingRegencies && <span className="text-xs text-muted-foreground animate-pulse">(Memuat...)</span>}
          </Label>
          <SearchableSelect
            options={regencies.map((r) => ({ value: r.id, label: toTitleCase(r.name) }))}
            value={regId}
            onChange={onRegencySelect}
            placeholder="Pilih Kota/Kabupaten"
            searchPlaceholder="Cari Kota/Kabupaten..."
            disabled={disabled || !provId || loadingRegencies}
          />
        </div>
      </div>

      {/* Row 2: Kecamatan, Kelurahan & Kode Pos (3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Kecamatan select */}
        <div>
          <Label htmlFor="indonesia-district" className="flex items-center gap-1.5 h-5 mb-1.5">
            Kecamatan {required && <span className="text-destructive">*</span>}
            {loadingDistricts && <span className="text-xs text-muted-foreground animate-pulse">(Memuat...)</span>}
          </Label>
          <SearchableSelect
            options={districts.map((d) => ({ value: d.id, label: toTitleCase(d.name) }))}
            value={distId}
            onChange={onDistrictSelect}
            placeholder="Pilih Kecamatan"
            searchPlaceholder="Cari Kecamatan..."
            disabled={disabled || !regId || loadingDistricts}
          />
        </div>

        {/* Kelurahan & Kode Pos */}
        {!fallbackMode ? (
          <>
            <div>
              <Label htmlFor="indonesia-village" className="flex items-center gap-1.5 h-5 mb-1.5">
                Kelurahan / Desa {required && <span className="text-destructive">*</span>}
                {loadingVillages && <span className="text-xs text-muted-foreground animate-pulse">(Memuat...)</span>}
              </Label>
              <SearchableSelect
                options={villages.map((v, idx) => ({
                  value: `${v.village}|${v.code}`,
                  label: toTitleCase(v.village),
                }))}
                value={kelurahan ? `${kelurahan}|${kodePos}` : ""}
                onChange={onVillageSelect}
                placeholder="Pilih Kelurahan / Desa"
                searchPlaceholder="Cari Kelurahan / Desa..."
                disabled={disabled || !kecamatan || loadingVillages}
              />
            </div>

            <div>
              <Label htmlFor="indonesia-zip-display" className="flex items-center gap-1.5 h-5 mb-1.5">
                Kode Pos
              </Label>
              <Input
                id="indonesia-zip-display"
                disabled
                placeholder="Kode Pos"
                value={kodePos}
              />
            </div>
          </>
        ) : (
          // Fallback fields when postal code API is down or empty
          <>
            <div>
              <Label htmlFor="indonesia-village-manual" className="flex items-center gap-1.5 h-5 mb-1.5">
                Kelurahan {required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="indonesia-village-manual"
                required={required}
                disabled={disabled}
                placeholder="Kelurahan"
                value={kelurahan}
                onChange={(e) => setKelurahan(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="indonesia-zip-manual" className="flex items-center gap-1.5 h-5 mb-1.5">
                Kode Pos {required && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="indonesia-zip-manual"
                required={required}
                disabled={disabled}
                placeholder="Kode Pos"
                value={kodePos}
                onChange={(e) => setKodePos(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* Alamat Lengkap (Manual Input) */}
      <div>
        <Label htmlFor="indonesia-street" className="flex items-center gap-1.5 h-5 mb-1.5">Alamat Lengkap (Jalan, Blok, No. Rumah, RT/RW) {required && <span className="text-destructive">*</span>}</Label>
        <Textarea
          id="indonesia-street"
          required={required}
          disabled={disabled}
          placeholder="Tuliskan nama jalan, RT/RW, nomor rumah secara lengkap"
          value={alamatDetail}
          onChange={(e) => setAlamatDetail(e.target.value)}
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}
