import { describe, expect, it } from "vitest";
import { isCurrencyCode } from "../data/career-save.ts";
import { moneyFiltersIn, pricedIn, shownCurrency } from "./currency.ts";
import { DEFAULT_SORT } from "./scout-state.ts";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";
import { TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

const loadPreferences = async (value: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", { schemaVersion: SCHEMA_VERSION.preferences, value });
  return (await createScoutStore(backend).load()).preferences;
};

describe("shownCurrency", () => {
  it("is the career's until the user picks one, and none without a career", () => {
    const career = { ...TEST_CAREER, currency: 1 } as const;
    expect(shownCurrency({ career })).toBe(1);
    expect(shownCurrency({ career, currency: 2 })).toBe(2);
    expect(shownCurrency({ career: null, currency: 2 })).toBeNull();
  });
});

describe("isCurrencyCode", () => {
  it("accepts the three currency codes only", () => {
    expect([0, 1, 2, 3, -1, "1", null].map(isCurrencyCode)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("pricedIn", () => {
  it("prices the players again from their euro amounts, never from the shown ones", () => {
    const player = testPlayer({
      price: 1,
      wage: 1,
      priceEuro: 15_449_999.6,
      wageEuro: 2_068_800,
      storedWage: true,
    });
    expect(pricedIn([player], 2)).toEqual([{ ...player, price: 22_000_000, wage: 2_917_010 }]);
    expect(pricedIn([testPlayer()], 1)[0]).toMatchObject({ price: null, wage: null });
  });
});

describe("moneyFiltersIn", () => {
  const filters = {
    text: "a",
    ranges: { price: { min: 1_000_000, max: 2_000_000 }, wage: { max: 8600 }, age: { max: 21 } },
  } as const;

  it("keeps the same amount of money in the new currency, in whole units", () => {
    // 1 000 000 € = 860 000 £; 8600 € = 7396 £; from pounds to dollars 860 000 * 1.41 / 0.86.
    expect(moneyFiltersIn(filters, 0, 1)).toEqual({
      text: "a",
      ranges: { price: { min: 860_000, max: 1_720_000 }, wage: { max: 7396 }, age: { max: 21 } },
    });
    expect(moneyFiltersIn({ ranges: { price: { min: 860_000 } } }, 1, 2)).toEqual({
      ranges: { price: { min: 1_410_000 } },
    });
  });

  it("leaves the filters alone in the same currency or without money bounds", () => {
    expect(moneyFiltersIn(filters, 2, 2)).toBe(filters);
    const noMoney = { ranges: { age: { max: 21 } } };
    expect(moneyFiltersIn(noMoney, 0, 2)).toEqual(noMoney);
    expect(moneyFiltersIn({}, 0, 2)).toEqual({});
  });
});

describe("the stored currency", () => {
  // A record without them loads as before: the career's currency, and a set's amounts in the career's one.
  it("keeps the chosen currency and the currency of each set, dropping unknown codes", async () => {
    const set = { name: "Tani", filters: {}, sort: DEFAULT_SORT };
    const value = {
      filters: {},
      sort: DEFAULT_SORT,
      currency: 2,
      filterSets: [
        { ...set, currency: 1 },
        { ...set, name: "Zły", currency: 3 },
      ],
    };
    const loaded = await loadPreferences(value);
    expect(loaded).toMatchObject({
      currency: 2,
      filterSets: [
        { ...set, currency: 1 },
        { ...set, name: "Zły" },
      ],
    });
    expect(loaded?.filterSets?.[1]).not.toHaveProperty("currency");
    const unknown = { ...value, currency: "2" };
    expect(await loadPreferences(unknown)).not.toHaveProperty("currency");
  });
});
