export function formatIDR(value: number | string | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isNaN(n)) return "Rp 0";
  return "Rp " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const SHIPPING_RATES: Record<string, number> = {
  JNE: 0,
  "J&T": 22000,
  SiCepat: 20000,
  AnterAja: 23000,
};

export const BANKS = [
  { code: "BCA", name: "Bank BCA", account: "1234567890", holder: "PT The Locker Room" },
  { code: "BRI", name: "Bank BRI", account: "0987654321", holder: "PT The Locker Room" },
  { code: "Mandiri", name: "Bank Mandiri", account: "1122334455", holder: "PT The Locker Room" },
];

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Menunggu Pembayaran",
    paid: "Pembayaran Diterima",
    processing: "Sedang Diproses",
    shipped: "Dikirim",
    delivered: "Selesai",
    cancelled: "Dibatalkan",
    waiting_payment: "Menunggu Pembayaran",
    waiting_verification: "Sudah Dibayar (Menunggu Konfirmasi)",
    approved: "Disetujui",
    rejected: "Ditolak",
  };
  return map[s] ?? s;
}

export function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/(?:^|\s|-)\S/g, (m) => m.toUpperCase());
}

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
