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
