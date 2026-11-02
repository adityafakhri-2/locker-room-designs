import { describe, it, expect } from "vitest";
import { getOrderPlatformFee, getOrderNetRevenue } from "./orderFee";

describe("orderFee helper", () => {
  it("extracts platform fee from direct platform_fee property", () => {
    expect(getOrderPlatformFee({ platform_fee: 12600 })).toBe(12600);
    expect(getOrderPlatformFee({ platform_fee: 0 })).toBe(0);
    expect(getOrderPlatformFee({ platform_fee: null })).toBe(0);
  });

  it("extracts platform fee from note fallback pattern", () => {
    expect(
      getOrderPlatformFee({
        note: "Admin Shopee [Biaya Platform: Rp 12.600]",
      }),
    ).toBe(12600);
    expect(
      getOrderPlatformFee({
        note: "Order TikTok [Platform Fee: 15000]",
      }),
    ).toBe(15000);
    expect(
      getOrderPlatformFee({
        note: "Order Tokopedia [Potongan Marketplace: Rp 10.000]",
      }),
    ).toBe(10000);
  });

  it("calculates net revenue with discount and platform fee", () => {
    const order = {
      subtotal: 120000,
      discount_amount: 10000,
      platform_fee: 12600,
    };
    expect(getOrderNetRevenue(order)).toBe(97400);
  });

  it("calculates net revenue with platform fee only", () => {
    const order = {
      subtotal: 120000,
      discount_amount: 0,
      platform_fee: 12600,
    };
    expect(getOrderNetRevenue(order)).toBe(107400);
  });
});

