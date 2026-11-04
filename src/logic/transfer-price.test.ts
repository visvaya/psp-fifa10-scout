import { describe, expect, it } from "vitest";
import { exchangeRate, marketWage, roundPrice, transferPrice } from "./transfer-price.ts";
import type { PriceInput } from "./transfer-price.ts";

/** OVR + OVR in five years = 195, the divider: the base is exactly 100 000 + 39 000 000. */
const BASE = 39_100_000;

/** Every adjustment at a known step: 3 years left +0.3, age 23 0, style none -0.05, prestige 30 0. */
const NEUTRAL: PriceInput = {
  positionCode: 14,
  overall: 98,
  overallIn5Years: 97,
  age: 23,
  contractYearsLeft: 3,
  internationalReputation: 1,
  playingStyle: 13,
  prestige: 30,
  exchangeRate: 1,
};

/** The price with the neutral adjustments plus `extra` (fractions of the base), central midfield 0.85. */
const priceWith = (extra: number, multiplier = 0.85): number =>
  roundPrice(BASE * (1 + 0.3 - 0.05 + extra) * multiplier);

describe("roundPrice", () => {
  it.each([
    [0, 0],
    [10, 10],
    [95, 90],
    [95.6, 100],
    [994, 990],
    [1000, 1000],
    [1044, 1000],
    [1046, 1100],
    [15_449_999.6, 15_000_000],
    [15_500_000, 16_000_000],
    [33_249_000, 33_000_000],
  ])("rounds %s to %s", (amount, rounded) => {
    expect(roundPrice(amount)).toBe(rounded);
  });
});

describe("transferPrice", () => {
  it("is zero without contract years left", () => {
    expect(transferPrice({ ...NEUTRAL, contractYearsLeft: 0 })).toBe(0);
    expect(transferPrice({ ...NEUTRAL, contractYearsLeft: -1 })).toBe(0);
  });

  it("grows the base with OVR and OVR in five years", () => {
    expect(transferPrice(NEUTRAL)).toBe(priceWith(0));
    const lower = { ...NEUTRAL, overall: 70, overallIn5Years: 60 };
    expect(transferPrice(lower)).toBe(
      roundPrice((100_000 + 39_000_000 * (130 / 195) ** 11) * 1.25 * 0.85),
    );
  });

  it.each([
    [1, -0.1],
    [2, 0.3],
    [4, 0.3],
    [7, 0.3],
  ])("adjusts for %d contract years left", (years, k) => {
    expect(transferPrice({ ...NEUTRAL, contractYearsLeft: years })).toBe(priceWith(k - 0.3));
  });

  it.each([
    [3, 0],
    [4, 0.1],
    [5, 0.35],
  ])("adjusts for international reputation %d", (reputation, k) => {
    expect(transferPrice({ ...NEUTRAL, internationalReputation: reputation })).toBe(priceWith(k));
  });

  it.each([
    [17, -0.05],
    [20, -0.05],
    [21, 0],
    [26, 0.1],
    [30, 0.1],
    [31, -0.3],
    [35, -0.3],
    [36, -0.6],
  ])("adjusts for age %d", (age, k) => {
    expect(transferPrice({ ...NEUTRAL, age })).toBe(priceWith(k));
  });

  it.each([
    [33, 0.1],
    [36, -0.3],
    [40, -0.3],
    [41, -0.6],
  ])("counts a goalkeeper five years younger in the oldest bands, age %d", (age, k) => {
    expect(transferPrice({ ...NEUTRAL, positionCode: 0, age })).toBe(priceWith(k, 0.6));
  });

  it.each([
    [0, 98, 0.15],
    [12, 85, 0.15],
    [5, 84, 0.1],
    [5, 80, 0.1],
    [5, 79, 0.05],
    [5, 75, 0.05],
    [5, 74, -0.05],
    [13, 98, -0.05],
    [-1, 98, -0.05],
  ])("adjusts for playing style %d at OVR %d", (playingStyle, overall, k) => {
    const input = { ...NEUTRAL, playingStyle, overall, overallIn5Years: 195 - overall };
    expect(transferPrice(input)).toBe(priceWith(k + 0.05));
  });

  it.each([
    [33, 0.1],
    [25, 0],
    [24, -0.1],
    [17, -0.1],
    [16, -0.25],
    [9, -0.25],
    [8, -0.35],
  ])("adjusts for league and team prestige %d", (prestige, k) => {
    expect(transferPrice({ ...NEUTRAL, prestige })).toBe(priceWith(k));
  });

  it.each([
    [0.6, [0, 1]],
    [0.7, [2, 3, 7, 8]],
    [0.75, [4, 6, 9, 13]],
    [0.85, [14, 20]],
    [1.2, [21, 25]],
    [1.15, [26, 31]],
  ])("multiplies by %s at positions %j", (multiplier, codes) => {
    for (const positionCode of codes) {
      expect(transferPrice({ ...NEUTRAL, positionCode })).toBe(priceWith(0, multiplier));
    }
  });

  it("skips an adjustment that would take the total to exactly zero", () => {
    // 1 - 0.1 (1 year) - 0.6 (age) - 0.05 (style) - 0.25 (prestige 9) = 0.
    const input = { ...NEUTRAL, contractYearsLeft: 1, age: 36, prestige: 9 };
    expect(transferPrice(input)).toBe(roundPrice(BASE * 0.25 * 0.85));
  });

  it("skips an adjustment that would take the total to zero or below", () => {
    // 1 - 0.1 (1 year) - 0.6 (age) - 0.05 (style) = 0.25; prestige -0.35 would end below zero.
    const input = { ...NEUTRAL, contractYearsLeft: 1, age: 36, prestige: 8 };
    expect(transferPrice(input)).toBe(roundPrice(BASE * 0.25 * 0.85));
  });
});

/** Prestige 40: a base of 40 000; OVR + OVR in five years = 200: the OVR factor (1 + 0.05) * 3. */
const WAGE_NEUTRAL: PriceInput = { ...NEUTRAL, overall: 100, overallIn5Years: 100, prestige: 40 };
/** The wage with style none -0.05 and the given sum of the other adjustments. */
const wageWith = (k: number, factor = 1): number =>
  roundPrice((40_000 + 500 + (k - 0.05) * 40_000) * 3.15 * factor);

describe("marketWage", () => {
  it("follows the wage formula", () => {
    expect(marketWage(WAGE_NEUTRAL, false)).toBe(wageWith(-0.2));
    const lower = { ...WAGE_NEUTRAL, overall: 60, overallIn5Years: 50, prestige: 20 };
    expect(marketWage(lower, false)).toBe(
      roundPrice((10_000 + 500 + -0.25 * 10_000) * 3 * ((110 / 200) ** 5 + 0.05)),
    );
  });

  it("adds the free-transfer factor", () => {
    expect(marketWage(WAGE_NEUTRAL, true)).toBe(wageWith(-0.2, 1.3));
  });

  it.each([
    [20, -0.35],
    [21, -0.2],
    [26, 0],
    [31, 0.1],
    [36, -0.2],
  ])("adjusts for age %d", (age, k) => {
    expect(marketWage({ ...WAGE_NEUTRAL, age }, false)).toBe(wageWith(k));
  });

  it.each([
    [29, 0.15],
    [23, 0.2],
    [17, 0],
    [11, 0.1],
    [5, -0.05],
    [7, -0.1],
    [0, -0.1],
  ])("adjusts for position %d", (positionCode, k) => {
    expect(marketWage({ ...WAGE_NEUTRAL, positionCode }, false)).toBe(wageWith(k - 0.2));
  });

  it("adjusts for playing style and international reputation", () => {
    const input = { ...WAGE_NEUTRAL, playingStyle: 2, internationalReputation: 5 };
    expect(marketWage(input, false)).toBe(wageWith(-0.2 + 0.25 + 0.2));
    expect(marketWage({ ...WAGE_NEUTRAL, internationalReputation: 4 }, false)).toBe(
      wageWith(-0.2 + 0.1),
    );
  });
});

describe("currency", () => {
  it("rates the euro, the pound and the dollar by the save's currency code", () => {
    expect(([0, 1, 2] as const).map(exchangeRate)).toEqual([1, 0.86, 1.41]);
  });

  it("converts to the selected currency before rounding", () => {
    expect(transferPrice({ ...NEUTRAL, exchangeRate: 0.86 })).toBe(priceWith(0, 0.85 * 0.86));
    expect(marketWage({ ...WAGE_NEUTRAL, exchangeRate: 1.41 }, true)).toBe(
      wageWith(-0.2, 1.3 * 1.41),
    );
  });
});
