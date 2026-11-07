/**
 * Utility functions and constants for Cash on Delivery (COD) / Ketemuan Langsung.
 */

export const COD_PRESET_LOCATIONS = [
  "Kantor CODEPOLITAN (Jl. Sangkuriang No. 8)",
  "Alun-Alun Cimahi",
  "Ambil ke Tempat (Jl. Kyai H. Usman Dhomiri Gg. Bakti No.1 No.21, RT.01/RW.03, Padasuka, Kec. Cimahi Tengah)",
] as const;

export const COD_TIME_SLOTS = [
  { id: "slot_morning", label: "07:00 - 08:00 (Pagi)" },
  { id: "slot_noon", label: "12:00 - 13:00 (Siang)" },
  { id: "slot_afternoon", label: "17:30 - 18:30 (Sore)" },
  { id: "slot_evening", label: "19:00 - 21:00 (Malam)" },
] as const;

export const STORE_WA_NUMBER = "62895808860080";
export const STORE_PHONE_DISPLAY = "0895-8088-60080";

export interface CodInfo {
  isCod: boolean;
  location: string;
  date: string;
  timeSlot: string;
  altPhone?: string;
  proofUrl?: string;
  rejectionReason?: string;
}

/**
 * Checks if an order is a COD (Ketemuan Langsung) order.
 */
export function isCodOrder(order?: {
  courier?: string | null;
  recipient_alamat?: string | null;
  note?: string | null;
} | null): boolean {
  if (!order) return false;
  if (order.courier && order.courier.toUpperCase() === "COD") return true;
  if (order.recipient_alamat && order.recipient_alamat.startsWith("COD:")) return true;
  if (order.note && order.note.includes("[COD")) return true;
  return false;
}

/**
 * Extracts structured COD information from order fields, note, or timeline.
 */
export function parseCodInfo(order?: any): CodInfo {
  if (!order || !isCodOrder(order)) {
    return {
      isCod: false,
      location: "",
      date: "",
      timeSlot: "",
    };
  }

  // 1. Direct columns if available
  let location = order.cod_location || "";
  let date = order.cod_date || "";
  let timeSlot = order.cod_time_slot || "";
  let altPhone = order.cod_alt_phone || "";
  let proofUrl = order.cod_proof_url || "";

  // 2. Parse from recipient_alamat fallback: "COD: [Location]"
  if (!location && order.recipient_alamat) {
    const locMatch = order.recipient_alamat.match(/^COD:\s*(.+)$/i);
    if (locMatch && locMatch[1]) {
      location = locMatch[1].trim();
    }
  }

  // 3. Parse from note tag fallback: "[COD: Lokasi | Jadwal: Tanggal Slot | Kontak: Phone]"
  if (order.note) {
    const noteMatch = order.note.match(/\[COD:\s*([^|\]]+)(?:\|\s*Jadwal:\s*([^|\]]+))?(?:\|\s*Kontak:\s*([^|\]]+))?\]/i);
    if (noteMatch) {
      if (!location && noteMatch[1]) location = noteMatch[1].trim();
      if (!date && noteMatch[2]) {
        const scheduleParts = noteMatch[2].trim().split(" ");
        date = scheduleParts[0] || "";
        timeSlot = scheduleParts.slice(1).join(" ") || "";
      }
      if (!altPhone && noteMatch[3]) altPhone = noteMatch[3].trim();
    }
  }

  // 4. Parse from timeline events
  if (Array.isArray(order.timeline)) {
    const codEvent = order.timeline.find((t: any) => t.cod_location || t.cod_date);
    if (codEvent) {
      if (!location && codEvent.cod_location) location = codEvent.cod_location;
      if (!date && codEvent.cod_date) date = codEvent.cod_date;
      if (!timeSlot && codEvent.cod_time_slot) timeSlot = codEvent.cod_time_slot;
      if (!proofUrl && codEvent.proof_url) proofUrl = codEvent.proof_url;
    }
  }

  return {
    isCod: true,
    location: location || "Outlet / Sesuai Kesepakatan",
    date: date || "",
    timeSlot: timeSlot || "",
    altPhone: altPhone || "",
    proofUrl: proofUrl || "",
    rejectionReason: order.cancel_reason?.startsWith("COD Ditolak:")
      ? order.cancel_reason.replace("COD Ditolak:", "").trim()
      : order.cancel_reason || "",
  };
}

/**
 * Builds a direct WhatsApp click-to-chat URL with a prefilled message for COD confirmation.
 */
export function formatCodWhatsAppUrl(params: {
  orderNumber: string;
  customerName: string;
  items?: Array<{ product_name?: string; size?: string | null; quantity?: number }>;
  total: number;
  location: string;
  date: string;
  timeSlot: string;
  altPhone?: string;
}): string {
  const itemsList = (params.items || [])
    .map((it) => `- ${it.product_name || "Jersey"} (${it.size || "All Size"}) x${it.quantity || 1}`)
    .join("\n");

  const formattedTotal = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(params.total);

  const text = `Halo Admin AA Jersey, saya ingin konfirmasi janji temu COD:

📋 *No. Pesanan:* ${params.orderNumber}
👤 *Nama:* ${params.customerName}
📍 *Lokasi COD:* ${params.location}
📅 *Jadwal Pertemuan:* ${params.date} (${params.timeSlot})
${params.altPhone ? `📞 *Kontak Tambahan:* ${params.altPhone}\n` : ""}
👕 *Rincian Pesanan:*
${itemsList || "- 1x Jersey"}

💰 *Total Bayar di Tempat:* ${formattedTotal}

Mohon dicek dan di-ACC ya min, terima kasih!`;

  return `https://wa.me/${STORE_WA_NUMBER}?text=${encodeURIComponent(text)}`;
}

