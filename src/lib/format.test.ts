import { describe, it, expect } from "vitest";
import {
  formatIDR,
  formatDate,
  formatDateTime,
  statusLabel,
  toTitleCase,
  parseAlamat,
} from "./format";

describe("formatIDR", () => {
  it("formats numbers to IDR currency format", () => {
    // We normalize non-breaking spaces for cross-platform compatibility
    const cleanStr = (s: string) => s.replace(/\s/g, " ");
    expect(cleanStr(formatIDR(150000))).toBe("Rp 150.000");
    expect(cleanStr(formatIDR(0))).toBe("Rp 0");
  });

  it("handles string numbers", () => {
    const cleanStr = (s: string) => s.replace(/\s/g, " ");
    expect(cleanStr(formatIDR("250000"))).toBe("Rp 250.000");
  });

  it("handles null, undefined and invalid values", () => {
    expect(formatIDR(null)).toBe("Rp 0");
    expect(formatIDR(undefined)).toBe("Rp 0");
    expect(formatIDR("not-a-number")).toBe("Rp 0");
  });
});

describe("formatDate", () => {
  it("formats ISO string date to Indonesian format", () => {
    expect(formatDate("2026-06-30")).toContain("Juni 2026");
  });

  it("handles Date objects", () => {
    const date = new Date("2026-12-25");
    expect(formatDate(date)).toContain("Desember 2026");
  });

  it("handles empty or null values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formats date with time in Indonesian style", () => {
    expect(formatDateTime("2026-06-30T15:30:00")).toContain("Jun 2026");
  });

  it("handles empty values", () => {
    expect(formatDateTime(null)).toBe("—");
  });
});

describe("statusLabel", () => {
  it("translates status codes to Indonesian user-friendly labels", () => {
    expect(statusLabel("pending")).toBe("Menunggu Pembayaran");
    expect(statusLabel("paid")).toBe("Pembayaran Diterima");
    expect(statusLabel("shipped")).toBe("Dikirim");
    expect(statusLabel("unknown")).toBe("unknown");
  });
});

describe("toTitleCase", () => {
  it("capitalizes the first letter of each word", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
    expect(toTitleCase("LOCKER ROOM")).toBe("Locker Room");
    expect(toTitleCase("tanstack-start")).toBe("Tanstack-Start");
  });

  it("handles empty strings", () => {
    expect(toTitleCase("")).toBe("");
  });
});

describe("parseAlamat", () => {
  it("parses address strings with Kecamatan first", () => {
    const addr = "Jl. Sudirman No. 12, Kec. Menteng, Kel. Gondangdia";
    const res = parseAlamat(addr);
    expect(res.street).toBe("Jl. Sudirman No. 12");
    expect(res.kecamatan).toBe("Menteng");
    expect(res.kelurahan).toBe("Gondangdia");
  });

  it("parses address strings with Kelurahan first", () => {
    const addr = "Jl. Thamrin No. 5, Kel. Gondangdia, Kec. Menteng";
    const res = parseAlamat(addr);
    expect(res.street).toBe("Jl. Thamrin No. 5");
    expect(res.kelurahan).toBe("Gondangdia");
    expect(res.kecamatan).toBe("Menteng");
  });

  it("returns default values for non-matching address strings", () => {
    const addr = "Jl. Kebon Jeruk No. 8";
    const res = parseAlamat(addr);
    expect(res.street).toBe("Jl. Kebon Jeruk No. 8");
    expect(res.kecamatan).toBe("");
    expect(res.kelurahan).toBe("");
  });

  it("handles empty address", () => {
    const res = parseAlamat("");
    expect(res.street).toBe("");
    expect(res.kecamatan).toBe("");
    expect(res.kelurahan).toBe("");
  });
});
