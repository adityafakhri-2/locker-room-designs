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
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const SHIPPING_RATES: Record<string, number> = {
  JNE: 25000,
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
