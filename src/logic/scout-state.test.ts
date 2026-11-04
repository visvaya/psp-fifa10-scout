import { describe, expect, it } from "vitest";
import {
  actionOf,
  activeFilters,
  activeLanguage,
  attributeBand,
  DEFAULT_SORT,
  effectiveFilters,
  listedCount,
  facetOptions,
  initialScoutState,
  scoutReducer,
} from "./scout-state.ts";
import type { FilterId, ScoutState } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

const PLAYERS = [testPlayer({ id: 1 }), testPlayer({ id: 2, clubId: 7 })];
const loading = scoutReducer(initialScoutState, { type: "load-started", requestId: 1 });

const SUCCEEDED = {
  type: "load-succeeded",
  requestId: 1,
  players: PLAYERS,
  myTeamId: null,
  career: null,
  languages: {},
  attachedLanguage: null,
} as const;

const loaded = (myTeamId: number | null = null, from: ScoutState = loading): ScoutState =>
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
    const filters = { text: "a", clubStatus: "free-agents", myClub: "only" } as const;
    expect(loaded(null, { ...loading, filters }).filters).toEqual({ text: "a" });
    expect(loaded(5, { ...loading, filters }).filters).toEqual(filters);
  });

  it("tracks the phase of the current load and stays on the start view after a picked file", () => {
    const reading = scoutReducer(loading, { type: "load-phase", requestId: 1, phase: "save" });
    expect(reading.loading).toEqual({ requestId: 1, phase: "save", restored: false });
    expect(loaded(5)).toMatchObject({
      players: PLAYERS,
      myTeamId: 5,
      loading: null,
      view: "start",
    });
    const career = { managerName: "A", clubName: "B", lastGameDate: new Date(0) };
    expect(scoutReducer(loading, { ...SUCCEEDED, myTeamId: 5, career }).career).toBe(career);
  });

  it("ignores phases and results of a superseded load", () => {
    const newer = scoutReducer(loading, { type: "load-started", requestId: 2 });
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
    const failed = scoutReducer(loading, {
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
    const restored = scoutReducer(loading, {
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
        filters: { ranges: { potential: { min: 80 }, growth: { min: 10 }, age: { max: 21 } } },
      }),
      { type: "sort-changed", key: "growth" },
    );
    expect(filtered).toMatchObject({ showPotential: true, sort: { key: "growth" } });
    const hidden = scoutReducer(filtered, { type: "potential-shown", shown: false });
    expect(hidden).toMatchObject({
      showPotential: false,
      filters: { ranges: { age: { max: 21 } } },
      sort: DEFAULT_SORT,
    });
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
      languages,
      attachedLanguage: "pol_pl",
    });
  });
});

describe("effectiveFilters", () => {
  it("count the players the list shows, as the start screen's button does", () => {
    const filtered = { ...loaded(), filters: { lists: { clubId: [7] } } };
    expect([initialScoutState, loaded(), filtered].map(listedCount)).toEqual([0, 2, 1]);
  });

  it("keeps the players one can sign, or only free agents in a career", () => {
    expect(effectiveFilters({}, null)).toEqual({ availableOnly: true });
    expect(effectiveFilters({}, 7)).toEqual({ availableOnly: true });
    expect(effectiveFilters({ clubStatus: "free-agents" }, 7)).toEqual({ freeAgentsOnly: true });
    // Without a career fifa.db has no free agents, so the option does not apply.
    expect(effectiveFilters({ clubStatus: "free-agents" }, null)).toEqual({ availableOnly: true });
  });

  it("turns 'my club' into the club id to hide or keep, only with a career", () => {
    expect(effectiveFilters({ myClub: "hide", text: "a" }, 7)).toEqual({
      text: "a",
      availableOnly: true,
      excludeTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "only" }, 7)).toEqual({ availableOnly: true, onlyTeamId: 7 });
    expect(effectiveFilters({ myClub: "hide" }, null)).toEqual({ availableOnly: true });
  });
});

describe("activeFilters", () => {
  it("lists each filter that narrows the list", () => {
    expect(
      activeFilters({
        text: " ",
        ranges: { age: { min: 18 }, potential: {}, finishing: { max: 0 } },
        clubStatus: "available",
      }),
    ).toEqual(["ranges.age", "ranges.finishing"]);
    expect(
      activeFilters({
        myClub: "hide",
        clubStatus: "free-agents",
        text: "a",
        lists: { leagueId: [1], clubId: [] },
        flags: { selfish: false, transferListed: undefined },
      }),
    ).toEqual(["text", "lists.leagueId", "flags.selfish", "clubStatus", "myClub"]);
  });
});

describe("attributeBand", () => {
  it("bands values at 80, 70 and 50", () => {
    expect([99, 80, 79, 70, 69, 50, 49, 1].map((value) => attributeBand(value))).toEqual([
      "high",
      "high",
      "good",
      "good",
      "average",
      "average",
      "low",
      "low",
    ]);
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
    expect(all.codes).toEqual({
      positionCode: [17],
      bodyType: [2],
      developmentType: [1],
      developmentStyle: [2],
    });
    expect(facetOptions(players, { lists: { leagueId: [2] } }).clubs).toEqual([
      { id: 5, name: "Śląsk" },
    ]);
  });

  it("orders names with the given collation", () => {
    const players = [
      testPlayer({ id: 1, clubId: 1, clubName: "Hradec" }),
      testPlayer({ id: 2, clubId: 2, clubName: "Chrudim" }),
    ];
    const names = (collator?: Intl.Collator) =>
      facetOptions(players, {}, collator).clubs.map((club) => club.name);
    expect(names()).toEqual(["Chrudim", "Hradec"]);
    expect(names(new Intl.Collator("cs"))).toEqual(["Hradec", "Chrudim"]);
  });
});
