import { describe, it, expect } from "vitest";

describe("Interactive Star Rating Logic", () => {
  it("clamps and validates rating between 1 and 5", () => {
    const clampRating = (val: number) => Math.max(1, Math.min(5, Math.round(val)));

    expect(clampRating(5)).toBe(5);
    expect(clampRating(1)).toBe(1);
    expect(clampRating(0)).toBe(1);
    expect(clampRating(6)).toBe(5);
    expect(clampRating(3.7)).toBe(4);
  });

  it("calculates active stars correctly for a given rating", () => {
    const isStarActive = (starIndex: number, currentRating: number) => starIndex <= currentRating;

    // For 4-star rating: stars 1, 2, 3, 4 active; star 5 inactive
    expect(isStarActive(1, 4)).toBe(true);
    expect(isStarActive(2, 4)).toBe(true);
    expect(isStarActive(3, 4)).toBe(true);
    expect(isStarActive(4, 4)).toBe(true);
    expect(isStarActive(5, 4)).toBe(false);

    // For 5-star rating: all active
    [1, 2, 3, 4, 5].forEach((s) => {
      expect(isStarActive(s, 5)).toBe(true);
    });
  });

  it("prioritizes hover rating over selected value", () => {
    const getDisplayedRating = (selected: number, hover: number | null) => hover ?? selected;

    expect(getDisplayedRating(3, 5)).toBe(5);
    expect(getDisplayedRating(5, 2)).toBe(2);
    expect(getDisplayedRating(4, null)).toBe(4);
  });
});

