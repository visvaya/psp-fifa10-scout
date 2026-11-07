import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

/** Shown in euro as the save (currency 0) prices him. */
const PLAYER = testPlayer({
  id: 1,
  price: 15_000_000,
  wage: 8700,
  priceEuro: 15_449_999.6,
  wageEuro: 8742.2,
});

const loadedCareer = (from: ScoutState = initialScoutState): ScoutState =>
  scoutReducer(scoutReducer(from, { type: "load-started", requestId: 1 }), {
    type: "load-succeeded",
    requestId: 1,
    players: [PLAYER],
    myTeamId: 5,
    career: TEST_CAREER,
    curves: new Map(),
    languages: {},
    attachedLanguage: null,
  });

const moneyOf = (state: ScoutState) =>
  state.players?.map(({ price, wage }) => ({ price, wage })) ?? [];

describe("choosing the currency", () => {
  it("prices the players again from euro and keeps the money filters' amount", () => {
    const filtered = scoutReducer(loadedCareer(), {
      type: "filters-changed",
      filters: { ranges: { price: { min: 1_000_000 }, wage: { max: 8600 } } },
    });
    const pounds = scoutReducer(filtered, { type: "currency-chosen", currency: 1 });
    expect(pounds.currency).toBe(1);
    expect(moneyOf(pounds)).toEqual([{ price: 13_000_000, wage: 7500 }]);
    expect(pounds.filters.ranges).toEqual({ price: { min: 860_000 }, wage: { max: 7396 } });
    const dollars = scoutReducer(pounds, { type: "currency-chosen", currency: 2 });
    expect(moneyOf(dollars)).toEqual([{ price: 22_000_000, wage: 12_000 }]);
    expect(dollars.filters.ranges?.price).toEqual({ min: 1_410_000 });
  });

  it("converts the undo steps' money bounds too, the other undo steps kept", () => {
    const filtered = scoutReducer(withSet(), {
      type: "filters-changed",
      filters: { ranges: { price: { max: 1_000_000 } } },
    });
    const deleted = scoutReducer(filtered, { type: "filter-set-deleted", name: "Tani" });
    const dollars = scoutReducer(deleted, { type: "currency-chosen", currency: 2 });
    const restored = scoutReducer(dollars, { type: "undo" });
    expect(restored.filterSets).toEqual([expect.objectContaining({ name: "Tani" })]);
    expect(restored.filters.ranges?.price).toEqual({ max: 1_410_000 });
    const before = scoutReducer(restored, { type: "undo" });
    expect(before.filters.ranges?.price).toEqual({ max: 2_820_000 });
  });

  it("goes back to the career's currency, left unset for the next career", () => {
    const dollars = scoutReducer(withSet(), { type: "currency-chosen", currency: 2 });
    const career = scoutReducer(dollars, { type: "currency-chosen", currency: null });
    expect(career).not.toHaveProperty("currency");
    expect(moneyOf(career)).toEqual([{ price: 15_000_000, wage: 8700 }]);
    expect(career.filters.ranges?.price).toEqual({ max: 2_000_000 });
  });

  it("is kept without a career, for the next career to load in", () => {
    const chosen = scoutReducer(initialScoutState, { type: "currency-chosen", currency: 2 });
    expect(chosen.currency).toBe(2);
    expect(moneyOf(loadedCareer(chosen))).toEqual([{ price: 22_000_000, wage: 12_000 }]);
  });

  it("shows a loaded career in the save's currency until one is chosen", () => {
    expect(loadedCareer().players?.[0]).toBe(PLAYER);
  });

  it("prices the loaded players in the restored currency", () => {
    const restored = scoutReducer(loadedCareer(), {
      type: "preferences-restored",
      preferences: {
        filters: {},
        sort: { key: "overall", direction: "descending" },
        showPotential: false,
        currency: 1,
      },
    });
    expect(restored.currency).toBe(1);
    expect(moneyOf(restored)).toEqual([{ price: 13_000_000, wage: 7500 }]);
  });

  it("keeps the chosen currency on a settings reset, like the language", () => {
    const chosen = scoutReducer(loadedCareer(), { type: "currency-chosen", currency: 1 });
    expect(scoutReducer(chosen, { type: "settings-reset" }).currency).toBe(1);
  });
});

const withSet = (): ScoutState =>
  scoutReducer(
    scoutReducer(loadedCareer(), {
      type: "filters-changed",
      filters: { ranges: { price: { max: 2_000_000 } } },
    }),
    { type: "filter-set-saved", name: "Tani" },
  );

describe("filter sets and the currency", () => {
  it("records the currency of a set's amounts and converts them when the set is loaded", () => {
    const saved = withSet();
    expect(saved.filterSets).toEqual([expect.objectContaining({ name: "Tani", currency: 0 })]);
    const dollars = scoutReducer(saved, { type: "currency-chosen", currency: 2 });
    const cleared = scoutReducer(dollars, { type: "filters-reset" });
    const loaded = scoutReducer(cleared, { type: "filter-set-loaded", name: "Tani" });
    expect(loaded.filters.ranges?.price).toEqual({ max: 2_820_000 });
  });

  // No currency could be chosen when it was saved: its amounts are in the career's (euro here).
  it("takes the amounts of a set saved without a currency as in the career's", () => {
    const old = {
      name: "Stary",
      filters: { ranges: { price: { max: 5 } } },
      sort: initialScoutState.sort,
    };
    const dollars = scoutReducer(
      { ...loadedCareer(), filterSets: [old] },
      { type: "currency-chosen", currency: 2 },
    );
    const loaded = scoutReducer(dollars, { type: "filter-set-loaded", name: "Stary" });
    expect(loaded.filters.ranges?.price).toEqual({ max: 7 });
  });
});
