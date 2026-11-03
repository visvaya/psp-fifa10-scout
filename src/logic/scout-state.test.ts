import { describe, expect, it } from "vitest";
import {
  activeFilterKeys,
  attributeBand,
  DEFAULT_SORT,
  effectiveFilters,
  facetOptions,
  initialScoutState,
  scoutReducer,
} from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

const PLAYERS = [testPlayer({ id: 1 }), testPlayer({ id: 2, clubId: 7 })];
const loading = scoutReducer(initialScoutState, { type: "load-started", requestId: 1 });

const loaded = (myTeamId: number | null = null): ScoutState =>
  scoutReducer(loading, {
    type: "load-succeeded",
    requestId: 1,
    players: PLAYERS,
    myTeamId,
  });

describe("scoutReducer loading", () => {
  it("starts empty on the start view", () => {
    expect(initialScoutState).toMatchObject({ players: null, loading: null, view: "start" });
  });

  it("tracks the phase of the current load and shows the list when it succeeds", () => {
    const reading = scoutReducer(loading, { type: "load-phase", requestId: 1, phase: "save" });
    expect(reading.loading).toEqual({ requestId: 1, phase: "save" });
    expect(loaded(5)).toMatchObject({ players: PLAYERS, myTeamId: 5, loading: null, view: "list" });
  });

  it("ignores phases and results of a superseded load", () => {
    const newer = scoutReducer(loading, { type: "load-started", requestId: 2 });
    for (const action of [
      { type: "load-phase", requestId: 1, phase: "players" },
      { type: "load-succeeded", requestId: 1, players: PLAYERS, myTeamId: null },
      { type: "load-failed", requestId: 1, error: { stage: "game", kind: "damaged" } },
    ] as const) {
      expect(scoutReducer(newer, action)).toBe(newer);
    }
  });

  it("keeps the loaded players and the view when a later load fails", () => {
    const again = scoutReducer(loaded(), { type: "load-started", requestId: 2 });
    const error = { stage: "save", kind: "wrong-game" } as const;
    const failed = scoutReducer(again, { type: "load-failed", requestId: 2, error });
    expect(failed).toMatchObject({ players: PLAYERS, loading: null, error });
  });

  it("clears an old error when a new load starts", () => {
    const failed = scoutReducer(loading, {
      type: "load-failed",
      requestId: 1,
      error: { stage: "game", kind: "damaged" },
    });
    expect(scoutReducer(failed, { type: "load-started", requestId: 2 }).error).toBeNull();
  });

  it("reports a save picked without both files", () => {
    const state = scoutReducer(initialScoutState, { type: "save-incomplete" });
    expect(state.error).toEqual({ stage: "save", kind: "missing-file" });
  });

  it("switches views", () => {
    expect(scoutReducer(loaded(), { type: "view-changed", view: "start" }).view).toBe("start");
  });
});

describe("scoutReducer filters, sort and card", () => {
  it("merges filter changes and removes one filter", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: { text: "mes", freeAgentsOnly: true },
    });
    const removed = scoutReducer(state, { type: "filter-removed", key: "text" });
    expect(removed.filters).toEqual({ freeAgentsOnly: true });
  });

  it("drops a change back to an empty value", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: { text: "a", leagueIds: [1] },
    });
    const cleared = scoutReducer(state, {
      type: "filters-changed",
      filters: { text: "", leagueIds: [], age: {} },
    });
    expect(cleared.filters).toEqual({});
  });

  it("resets filters and sort", () => {
    const state = scoutReducer(
      scoutReducer(initialScoutState, { type: "filters-changed", filters: { text: "a" } }),
      { type: "sort-changed", key: "age" },
    );
    expect(scoutReducer(state, { type: "filters-reset" })).toMatchObject({
      filters: {},
      sort: DEFAULT_SORT,
    });
  });

  it("sorts by a new column in its natural direction and toggles a repeated one", () => {
    const byName = scoutReducer(initialScoutState, { type: "sort-changed", key: "name" });
    expect(byName.sort).toEqual({ key: "name", direction: "ascending" });
    const byPotential = scoutReducer(byName, { type: "sort-changed", key: "potential" });
    expect(byPotential.sort).toEqual({ key: "potential", direction: "descending" });
    expect(scoutReducer(byPotential, { type: "sort-changed", key: "potential" }).sort).toEqual({
      key: "potential",
      direction: "ascending",
    });
  });

  it("restores saved preferences", () => {
    const sort = { key: "age", direction: "ascending" } as const;
    const state = scoutReducer(initialScoutState, {
      type: "preferences-restored",
      preferences: { filters: { text: "x" }, sort },
    });
    expect(state).toMatchObject({ filters: { text: "x" }, sort });
  });

  it("opens and closes the player card", () => {
    const open = scoutReducer(loaded(), { type: "player-opened", id: 2 });
    expect(open.openPlayerId).toBe(2);
    expect(scoutReducer(open, { type: "player-closed" }).openPlayerId).toBeNull();
  });
});

describe("effectiveFilters", () => {
  it("turns 'exclude my club' into the club id, only with a career", () => {
    expect(effectiveFilters({ excludeMyClub: true, text: "a" }, 7)).toEqual({
      text: "a",
      excludeTeamId: 7,
    });
    expect(effectiveFilters({ excludeMyClub: true }, null)).toEqual({});
  });
});

describe("activeFilterKeys", () => {
  it("lists the filters that narrow the list", () => {
    expect(
      activeFilterKeys({ text: " ", age: { min: 18 }, potential: {}, freeAgentsOnly: false }),
    ).toEqual(["age"]);
    expect(activeFilterKeys({ excludeMyClub: true, leagueIds: [1] })).toEqual([
      "leagueIds",
      "excludeMyClub",
    ]);
  });
});

describe("attributeBand", () => {
  it.each([
    [99, "high"],
    [80, "high"],
    [79, "good"],
    [70, "good"],
    [69, "average"],
    [50, "average"],
    [49, "low"],
    [1, "low"],
  ])("%d is %s", (value, band) => {
    expect(attributeBand(value)).toBe(band);
  });
});

describe("facetOptions", () => {
  it("lists leagues, clubs (within the chosen leagues) and nationalities in Polish order", () => {
    const players = [
      testPlayer({ id: 1, leagueId: 2, leagueName: "Łotwa", clubId: 5, clubName: "Śląsk" }),
      testPlayer({
        id: 2,
        leagueId: 1,
        leagueName: "Liga",
        clubId: 6,
        clubName: "Sokół",
        contractEndYear: 2011,
      }),
      testPlayer({
        id: 3,
        leagueId: null,
        leagueName: null,
        clubId: null,
        clubName: null,
        nationalityId: 9,
        nationalityName: null,
        contractEndYear: null,
      }),
    ];
    const all = facetOptions(players, {});
    expect(all.leagues).toEqual([
      { id: 1, name: "Liga" },
      { id: 2, name: "Łotwa" },
    ]);
    expect(all.clubs.map((club) => club.name)).toEqual(["Sokół", "Śląsk"]);
    expect(all.nationalities).toEqual([{ id: 1, name: "Country" }]);
    expect(all.contractYears).toEqual([2011, 2012]);
    expect(facetOptions(players, { leagueIds: [2] }).clubs).toEqual([{ id: 5, name: "Śląsk" }]);
  });
});
