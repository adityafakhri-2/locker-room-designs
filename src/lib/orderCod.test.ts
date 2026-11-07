import { describe, it, expect } from "vitest";
import {
  isCodOrder,
  parseCodInfo,
  formatCodWhatsAppUrl,
  COD_PRESET_LOCATIONS,
  COD_TIME_SLOTS,
} from "./orderCod";

describe("orderCod helper", () => {
  it("identifies COD order by courier", () => {
    expect(isCodOrder({ courier: "COD" })).toBe(true);
    expect(isCodOrder({ courier: "cod" })).toBe(true);
    expect(isCodOrder({ courier: "JNE" })).toBe(false);
  });

  it("identifies COD order by address prefix", () => {
    expect(isCodOrder({ recipient_alamat: "COD: Alun-Alun Cimahi" })).toBe(true);
    expect(isCodOrder({ recipient_alamat: "Jl. Sudirman No 10" })).toBe(false);
  });

  it("parses COD info from note fallback", () => {
    const order = {
      courier: "COD",
      recipient_alamat: "COD: Alun-Alun Cimahi",
      note: "Catatan [COD: Alun-Alun Cimahi | Jadwal: 2026-11-10 12:00-13:00 | Kontak: 081299998888]",
    };
    const info = parseCodInfo(order);
    expect(info.isCod).toBe(true);
    expect(info.location).toBe("Alun-Alun Cimahi");
    expect(info.date).toBe("2026-11-10");
    expect(info.timeSlot).toBe("12:00-13:00");
    expect(info.altPhone).toBe("081299998888");
  });

  it("generates WhatsApp URL with order details", () => {
    const url = formatCodWhatsAppUrl({
      orderNumber: "ORD-2026-1234",
      customerName: "Budi Santoso",
      location: "Kantor CODEPOLITAN (Jl. Sangkuriang No. 8)",
      date: "2026-11-10",
      timeSlot: "12:00 - 13:00 (Siang)",
      total: 140000,
      items: [{ product_name: "Como 1907 Home 26/27", size: "M", quantity: 1 }],
    });
    expect(url).toContain("wa.me/62895808860080");
    expect(url).toContain("ORD-2026-1234");
    expect(url).toContain("Budi%20Santoso");
    expect(url).toContain("CODEPOLITAN");
  });

  it("has the 3 specified preset locations and 4 time slots", () => {
    expect(COD_PRESET_LOCATIONS.length).toBe(3);
    expect(COD_TIME_SLOTS.length).toBe(4);
  });
});
