import { describe, expect, it } from "vitest";
import {
  actionOf,
  activeFilters,
  activeLanguage,
  DEFAULT_SORT,
  listedCount,
  initialScoutState,
  scoutReducer,
} from "./scout-state.ts";
import type { FilterId, ScoutState } from "./scout-state.ts";
import { TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

const PLAYERS = [testPlayer({ id: 1 }), testPlayer({ id: 2, clubId: 7 })];
// A function, not a constant: state built when the file loads hides the reducer from mutation testing.
const loadingState = (): ScoutState =>
  scoutReducer(initialScoutState, { type: "load-started", requestId: 1 });

const SUCCEEDED = {
  type: "load-succeeded",
  requestId: 1,
  players: PLAYERS,
  myTeamId: null,
  career: null,
  curves: new Map(),
  languages: {},
  attachedLanguage: null,
} as const;

const loaded = (myTeamId: number | null = null, from: ScoutState = loadingState()): ScoutState =>
  scoutReducer(from, { ...SUCCEEDED, myTeamId });

const NAMES = {
  teams: { 1: "Klub" },
  leagues: {},
  countries: {},
  positions: {},
  positionNames: {},
};

describe("scoutReducer loading", () => {
  it("starts empty on the start view", () => {
    expect(initialScoutState).toMatchObject({ players: null, loading: null, view: "start" });
  });

  it("drops the career-only filters when a load brings no career", () => {
    const filters = {
      text: "a",
      clubStatus: "free-agents",
      myClub: "only",
      ranges: {
        peak: { min: 70 },
        peakGain: { min: 1 },
        age: { max: 21 },
        cleanSheets: { min: 1 },
      },
      flags: { clubWillSell: true, transferListed: true, loanListed: true, loaned: false },
    } as const;
    expect(loaded(null, { ...loadingState(), filters }).filters).toEqual({
      text: "a",
      ranges: { age: { max: 21 } },
    });
    expect(loaded(5, { ...loadingState(), filters }).filters).toEqual(filters);
    const byPeak = { ...loadingState(), sort: { key: "peak", direction: "descending" } } as const;
    expect(loaded(null, byPeak).sort).toEqual(DEFAULT_SORT);
    expect(loaded(5, byPeak).sort).toEqual(byPeak.sort);
    for (const key of ["cupAppearances", "peakGain"] as const) {
      expect(
        loaded(null, { ...loadingState(), sort: { key, direction: "ascending" } }).sort,
      ).toEqual(DEFAULT_SORT);
    }
  });

  it("tracks the phase of the current load and stays on the start view after a picked file", () => {
    const reading = scoutReducer(loadingState(), {
      type: "load-phase",
      requestId: 1,
      phase: "save",
    });
    expect(reading.loading).toEqual({ requestId: 1, phase: "save", restored: false });
    expect(loaded(5)).toMatchObject({
      players: PLAYERS,
      myTeamId: 5,
      loading: null,
      view: "start",
    });
    const career = TEST_CAREER;
    expect(scoutReducer(loadingState(), { ...SUCCEEDED, myTeamId: 5, career }).career).toBe(career);
    const curves = new Map([[1, [50]]]);
    expect(scoutReducer(loadingState(), { ...SUCCEEDED, curves }).curves).toBe(curves);
  });

  it("ignores phases and results of a superseded load", () => {
    const newer = scoutReducer(loadingState(), { type: "load-started", requestId: 2 });
    for (const action of [
      { type: "load-phase", requestId: 1, phase: "players" },
      SUCCEEDED,
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
    const failed = scoutReducer(loadingState(), {
      type: "load-failed",
      requestId: 1,
      error: { stage: "game", kind: "damaged" },
    });
    expect(scoutReducer(failed, { type: "load-started", requestId: 2 }).error).toBeNull();
  });

  it("reports a save or language picked without both files", () => {
    for (const stage of ["save", "locale"] as const) {
      const state = scoutReducer(initialScoutState, { type: "files-incomplete", stage });
      expect(state.error).toEqual({ stage, kind: "missing-file" });
    }
  });

  it("adds the languages of a load and of the store to those known", () => {
    const restored = scoutReducer(loadingState(), {
      type: "languages-restored",
      languages: { eng_us: NAMES },
    });
    const added = scoutReducer(restored, { ...SUCCEEDED, languages: { pol_pl: NAMES } });
    expect(Object.keys(added.languages)).toEqual(["eng_us", "pol_pl"]);
    expect(added).not.toHaveProperty("gameLanguage");
    const attached = scoutReducer(scoutReducer(added, { type: "load-started", requestId: 2 }), {
      ...SUCCEEDED,
      requestId: 2,
      languages: { cze_cz: NAMES },
      attachedLanguage: "cze_cz",
    });
    expect(attached.gameLanguage).toBe("cze_cz");
  });

  it("chooses the game language, the browser's by default", () => {
    const known = scoutReducer(initialScoutState, {
      type: "languages-restored",
      languages: { pol_pl: NAMES, cze_cz: NAMES },
    });
    expect(activeLanguage(known, ["cs-CZ"])).toBe("cze_cz");
    expect(activeLanguage(known, ["de"])).toBeNull();
    const english = scoutReducer(known, { type: "language-chosen", language: null });
    expect(english.gameLanguage).toBeNull();
    expect(activeLanguage(english, ["cs-CZ"])).toBeNull();
    const polish = scoutReducer(known, { type: "language-chosen", language: "pol_pl" });
    expect(activeLanguage(polish, ["cs-CZ"])).toBe("pol_pl");
    expect(activeLanguage({ ...polish, languages: {} }, ["pl"])).toBeNull();
    // A stored name of an Object method is no language.
    expect(activeLanguage({ ...polish, gameLanguage: "constructor" }, ["pl"])).toBeNull();
  });

  it("switches views", () => {
    expect(scoutReducer(loaded(), { type: "view-changed", view: "start" }).view).toBe("start");
  });
});

const remove = (current: ScoutState, id: FilterId) =>
  scoutReducer(current, { type: "filter-removed", id });

describe("scoutReducer filters, sort and card", () => {
  it("merges filter changes and removes one filter", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: { text: "mes", clubStatus: "free-agents" },
    });
    const removed = scoutReducer(state, { type: "filter-removed", id: "text" });
    expect(removed.filters).toEqual({ clubStatus: "free-agents" });
  });

  it("removes one range, list or flag and keeps the others", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: {
        ranges: { age: { max: 23 }, dribbling: { min: 80 } },
        lists: { leagueId: [1] },
        flags: { leadership: true, diver: false },
      },
    });
    expect(remove(state, "ranges.dribbling").filters).toEqual({
      ranges: { age: { max: 23 } },
      lists: { leagueId: [1] },
      flags: { leadership: true, diver: false },
    });
    expect(remove(remove(state, "lists.leagueId"), "flags.diver").filters).toEqual({
      ranges: { age: { max: 23 }, dribbling: { min: 80 } },
      flags: { leadership: true },
    });
  });

  it("keeps a list's exclusion only while the list has values, and removes it with the list", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: {
        lists: { leagueId: [1], clubId: [] },
        excludedLists: { leagueId: true, clubId: true, nationalityId: false },
      },
    });
    expect(state.filters).toEqual({
      lists: { leagueId: [1] },
      excludedLists: { leagueId: true },
    });
    expect(remove(state, "lists.leagueId").filters).toEqual({});
  });

  it("drops a change back to an empty value", () => {
    const state = scoutReducer(initialScoutState, {
      type: "filters-changed",
      filters: { text: "a", lists: { leagueId: [1] }, flags: { diver: true } },
    });
    const cleared = scoutReducer(state, {
      type: "filters-changed",
      filters: {
        text: "",
        lists: { leagueId: [] },
        ranges: { age: {}, height: { min: undefined } },
        flags: { diver: undefined },
      },
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
    expect(DEFAULT_SORT).toEqual({ key: "overall", direction: "descending" });
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
      preferences: { filters: { text: "x" }, sort, showPotential: true, gameLanguage: "pol_pl" },
    });
    expect(state).toMatchObject({
      filters: { text: "x" },
      sort,
      showPotential: true,
      gameLanguage: "pol_pl",
    });
  });

  it("hides potential by default and drops its filters and sort when hidden", () => {
    expect(initialScoutState.showPotential).toBe(false);
    const shown = scoutReducer(initialScoutState, { type: "potential-shown", shown: true });
    const filtered = scoutReducer(
      scoutReducer(shown, {
        type: "filters-changed",
        filters: {
          ranges: {
            potential: { min: 80 },
            growth: { min: 10 },
            peak: { min: 70 },
            peakGain: { min: 1 },
            age: { max: 21 },
          },
        },
      }),
      { type: "sort-changed", key: "peakGain" },
    );
    expect(filtered).toMatchObject({ showPotential: true, sort: { key: "peakGain" } });
    const hidden = scoutReducer(filtered, { type: "potential-shown", shown: false });
    expect(hidden).toMatchObject({ showPotential: false, sort: DEFAULT_SORT });
    expect(hidden.filters).toEqual({ ranges: { age: { max: 21 } } });
    const byAge = scoutReducer(filtered, { type: "sort-changed", key: "age" });
    expect(scoutReducer(byAge, { type: "potential-shown", shown: false }).sort.key).toBe("age");
  });

  it("restores hidden potential without its filters and sort", () => {
    const state = scoutReducer(initialScoutState, {
      type: "preferences-restored",
      preferences: {
        filters: { ranges: { potential: { min: 80 } } },
        sort: { key: "potential", direction: "ascending" },
        showPotential: false,
      },
    });
    expect(state).toMatchObject({ filters: {}, sort: DEFAULT_SORT, showPotential: false });
  });

  it("sorts by the position rating only while that filter is set", () => {
    const rated = scoutReducer(
      scoutReducer(initialScoutState, {
        type: "filters-changed",
        filters: { positionRating: { code: 3, min: 70 } },
      }),
      { type: "sort-changed", key: "positionRating" },
    );
    expect(rated.sort).toEqual({ key: "positionRating", direction: "descending" });
    expect(activeFilters(rated.filters)).toEqual(["positionRating"]);
    expect(remove(rated, "positionRating")).toMatchObject({ filters: {}, sort: DEFAULT_SORT });
    const byGain = scoutReducer(rated, { type: "sort-changed", key: "ratingGain" });
    expect(remove(byGain, "positionRating")).toMatchObject({ sort: DEFAULT_SORT });
    const restored = scoutReducer(initialScoutState, {
      type: "preferences-restored",
      preferences: { filters: {}, sort: rated.sort, showPotential: true },
    });
    expect(restored.sort).toEqual(DEFAULT_SORT);
  });

  it("loads a set without what needs a career when there is none, keeping the set", () => {
    const filters = { myClub: "only", ranges: { peak: { min: 70 }, age: { max: 21 } } } as const;
    const set = {
      name: "Kariera",
      filters,
      sort: { key: "peak", direction: "descending" },
    } as const;
    const state = { ...initialScoutState, showPotential: true, filterSets: [set] };
    const back = scoutReducer(state, { type: "filter-set-loaded", name: "Kariera" });
    expect(back).toMatchObject({ filters: { ranges: { age: { max: 21 } } }, sort: DEFAULT_SORT });
    expect(back.filterSets).toEqual([set]);
    const career = scoutReducer(
      { ...state, myTeamId: 5 },
      { type: "filter-set-loaded", name: "Kariera" },
    );
    expect(career).toMatchObject({ filters, sort: set.sort });
  });

  it("restores the stored filter sets with the preferences", () => {
    const filterSets = [{ name: "A", filters: {}, sort: DEFAULT_SORT }];
    const preferences = { filters: {}, sort: DEFAULT_SORT, showPotential: false, filterSets };
    expect(
      scoutReducer(initialScoutState, { type: "preferences-restored", preferences }).filterSets,
    ).toEqual(filterSets);
  });

  it("saves, loads, renames and deletes named filter sets", () => {
    const shown = scoutReducer(initialScoutState, { type: "potential-shown", shown: true });
    const byAge = scoutReducer(
      scoutReducer(shown, {
        type: "filters-changed",
        filters: { ranges: { growth: { min: 10 } } },
      }),
      { type: "sort-changed", key: "age" },
    );
    const saved = scoutReducer(byAge, { type: "filter-set-saved", name: "Perełki" });
    expect(saved.filterSets).toEqual([
      { name: "Perełki", filters: byAge.filters, sort: byAge.sort },
    ]);
    // Loading brings back the filters and sort, and shows the potential a growth filter needs.
    const reset = scoutReducer(saved, { type: "potential-shown", shown: false });
    const back = scoutReducer(reset, { type: "filter-set-loaded", name: "Perełki" });
    expect(back).toMatchObject({ filters: byAge.filters, sort: byAge.sort, showPotential: true });
    const renamed = scoutReducer(back, { type: "filter-set-renamed", from: "Perełki", to: "LO" });
    expect(renamed.filterSets?.map((set) => set.name)).toEqual(["LO"]);
    expect(scoutReducer(renamed, { type: "filter-set-deleted", name: "LO" }).filterSets).toEqual(
      [],
    );
  });

  it("keeps the potential setting when filters are reset", () => {
    const shown = scoutReducer(initialScoutState, { type: "potential-shown", shown: true });
    expect(scoutReducer(shown, { type: "filters-reset" }).showPotential).toBe(true);
  });

  it("opens and closes the player card", () => {
    const open = scoutReducer(loaded(), { type: "player-opened", id: 2 });
    expect(open.openPlayerId).toBe(2);
    expect(scoutReducer(open, { type: "player-closed" }).openPlayerId).toBeNull();
  });
});

describe("actionOf", () => {
  it("maps each worker message to its load action", () => {
    expect(actionOf({ type: "phase", requestId: 3, phase: "save" })).toEqual({
      type: "load-phase",
      requestId: 3,
      phase: "save",
    });
    const error = { stage: "game", kind: "damaged" } as const;
    expect(actionOf({ type: "failed", requestId: 3, error })).toEqual({
      type: "load-failed",
      requestId: 3,
      error,
    });
    const languages = { pol_pl: NAMES };
    const result = {
      players: PLAYERS,
      myTeamId: 7,
      career: null,
      curves: new Map(),
      gameDb: Uint8Array.of(1),
      languages,
      attachedLanguage: "pol_pl",
    };
    expect(actionOf({ type: "done", requestId: 3, result })).toEqual({
      type: "load-succeeded",
      requestId: 3,
      players: PLAYERS,
      myTeamId: 7,
      career: null,
      curves: new Map(),
      languages,
      attachedLanguage: "pol_pl",
    });
  });
});

describe("listedCount", () => {
  it("count the players the list shows, as the start screen's button does", () => {
    const filtered = { ...loaded(), filters: { lists: { clubId: [7] } } };
    expect([initialScoutState, loaded(), filtered].map(listedCount)).toEqual([0, 2, 1]);
  });
});
