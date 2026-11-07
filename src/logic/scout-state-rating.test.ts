import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

/** The peak range at the chosen position, sorted by that peak, with potential shown. */
const ranged = (): ScoutState => {
  const shown = scoutReducer(initialScoutState, { type: "potential-shown", shown: true });
  const filtered = scoutReducer(shown, {
    type: "filters-changed",
    filters: { positionRating: { code: 3, min: 60, peak: { min: 70 } } },
  });
  return scoutReducer(filtered, { type: "sort-changed", key: "positionPeak" });
};

const loaded = (state: ScoutState, myTeamId: number | null): ScoutState =>
  scoutReducer(scoutReducer(state, { type: "load-started", requestId: 1 }), {
    type: "load-succeeded",
    requestId: 1,
    players: [testPlayer()],
    myTeamId,
    career: null,
    curves: new Map(),
    languages: {},
    attachedLanguage: null,
  });

describe("the peak at the chosen position", () => {
  it("is dropped with its sort when potential is hidden, keeping the position", () => {
    expect(ranged().sort.key).toBe("positionPeak");
    const hidden = scoutReducer(ranged(), { type: "potential-shown", shown: false });
    expect(hidden.filters).toEqual({ positionRating: { code: 3, min: 60 } });
    expect(hidden.sort).toEqual(DEFAULT_SORT);
  });

  it("is dropped with its sort when a load brings no career", () => {
    expect(loaded(ranged(), null)).toMatchObject({
      filters: { positionRating: { code: 3, min: 60 } },
      sort: DEFAULT_SORT,
    });
    expect(loaded(ranged(), 5)).toMatchObject({
      filters: { positionRating: { code: 3, min: 60, peak: { min: 70 } } },
      sort: { key: "positionPeak" },
    });
  });
});

describe("the position rating's ranges", () => {
  it("leave the filter when cleared, so nothing counts an empty range as set", () => {
    const cleared = scoutReducer(ranged(), {
      type: "filters-changed",
      filters: { positionRating: { code: 3, min: 60, gain: {}, peak: {} } },
    });
    expect(cleared.filters).toEqual({ positionRating: { code: 3, min: 60 } });
    const unticked = scoutReducer(ranged(), {
      type: "filters-changed",
      filters: { positionRating: { code: 3, bestOnly: false } },
    });
    expect(unticked.filters).toEqual({ positionRating: { code: 3 } });
  });
});

/** Potential shown, sorted by the peak, the peak ranged from 80, counted at the best position. */
const atBest = (): ScoutState => {
  const shown = scoutReducer(initialScoutState, { type: "potential-shown", shown: true });
  const sorted = scoutReducer(shown, { type: "sort-changed", key: "peak" });
  return scoutReducer(sorted, {
    type: "filters-changed",
    filters: { ranges: { peak: { min: 80 } }, peakAtBest: true },
  });
};

describe("the peak at the best position", () => {
  it("keeps the stored sort and ranges on the peak, whichever the mode", () => {
    expect(atBest()).toMatchObject({
      filters: { ranges: { peak: { min: 80 } }, peakAtBest: true },
      sort: { key: "peak" },
    });
    const off = scoutReducer(atBest(), { type: "filters-changed", filters: { peakAtBest: false } });
    expect(off).toMatchObject({
      filters: { ranges: { peak: { min: 80 } } },
      sort: { key: "peak" },
    });
    expect(off.filters.peakAtBest).toBeUndefined();
  });

  it("stores a click on a best peak header as the peak, turning its direction", () => {
    const first = scoutReducer(atBest(), { type: "sort-changed", key: "bestPeak" });
    expect(first.sort).toEqual({ key: "peak", direction: "ascending" });
    expect(scoutReducer(first, { type: "sort-changed", key: "bestPeakGain" }).sort).toEqual({
      key: "peakGain",
      direction: "descending",
    });
  });

  it("is dropped when potential is hidden", () => {
    const hidden = scoutReducer(atBest(), { type: "potential-shown", shown: false });
    expect(hidden.filters).toEqual({});
    expect(hidden.sort).toEqual(DEFAULT_SORT);
  });

  it("is dropped when a load brings no career", () => {
    expect(loaded(atBest(), null)).toMatchObject({ filters: {}, sort: DEFAULT_SORT });
    expect(loaded(atBest(), 5)).toMatchObject({
      filters: { peakAtBest: true },
      sort: { key: "peak" },
    });
  });
});
