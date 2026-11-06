import { describe, expect, it } from "vitest";
import { SCOUT_CONFIG } from "./config.ts";
import { DEFAULT_SORT, initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";

const run = (actions: readonly ScoutAction[], from: ScoutState = initialScoutState): ScoutState =>
  actions.reduce(scoutReducer, from);

const goalkeepers = {
  type: "filters-changed",
  filters: { lists: { positionGroup: ["goalkeeper"] } },
} as const;

/** A finished load of an empty game, for the load with `requestId`. */
const loadSucceeded = (requestId: number): ScoutAction => ({
  type: "load-succeeded",
  requestId,
  players: [],
  myTeamId: null,
  career: null,
  languages: {},
  attachedLanguage: null,
});

describe("undo", () => {
  it("takes back the last change of the filters, the sort or the sets, one at a time", () => {
    const changed = run([
      goalkeepers,
      { type: "sort-changed", key: "age" },
      { type: "filter-set-saved", name: "Bramkarze" },
    ]);
    const once = run([{ type: "undo" }], changed);
    expect(once.filterSets ?? []).toEqual([]);
    expect(once.sort.key).toBe("age");
    const twice = run([{ type: "undo" }], once);
    expect(twice.sort).toEqual(DEFAULT_SORT);
    expect(twice.filters).toEqual(goalkeepers.filters);
    expect(run([{ type: "undo" }], twice).filters).toEqual({});
  });

  it("leaves out what changes nothing it keeps, and does nothing with no step left", () => {
    const opened = run([{ type: "player-opened", id: 7 }]);
    expect(opened.undo).toEqual([]);
    expect(run([{ type: "filters-reset" }]).undo).toEqual([]);
    expect(run([{ type: "undo" }])).toBe(initialScoutState);
  });

  it("keeps a limited number of steps", () => {
    const sorts = Array.from({ length: SCOUT_CONFIG.undoSteps + 5 }, (): ScoutAction => ({
      type: "sort-changed",
      key: "age",
    }));
    expect(run(sorts).undo).toHaveLength(SCOUT_CONFIG.undoSteps);
  });
});

describe("undo of each change", () => {
  const saved = run([goalkeepers, { type: "filter-set-saved", name: "A" }]);

  it.each([
    ["shows the potential", { type: "potential-shown", shown: true }],
    ["loads a set", { type: "filter-set-loaded", name: "A" }],
    ["renames a set", { type: "filter-set-renamed", from: "A", to: "B" }],
    ["deletes a set", { type: "filter-set-deleted", name: "A" }],
  ] as const)("brings back what was before it %s", (_name, action) => {
    const changed = run([{ type: "filters-reset" }, action], saved);
    const before = run([{ type: "undo" }], changed);
    expect(before.showPotential).toBe(false);
    // The named change taken back, not the reset before it.
    expect(before.filters).toEqual({});
    expect(before.filterSets?.map((set) => set.name)).toEqual(["A"]);
  });
});

// A load or restored preferences replace the context the steps were taken in.
describe("undo across loads", () => {
  it("starts afresh when stored preferences are restored", () => {
    const changed = run([goalkeepers]);
    const restored = run(
      [
        {
          type: "preferences-restored",
          preferences: { filters: {}, sort: DEFAULT_SORT, showPotential: true },
        },
      ],
      changed,
    );
    expect(restored.undo).toEqual([]);
    expect(run([{ type: "undo" }], restored).showPotential).toBe(true);
  });

  it("starts afresh when a load succeeds", () => {
    const loading = run([goalkeepers, { type: "load-started", requestId: 1 }]);
    expect(run([loadSucceeded(1)], loading).undo).toEqual([]);
  });

  it("keeps the steps when a superseded load finishes", () => {
    const loading = run([goalkeepers, { type: "load-started", requestId: 2 }]);
    const stale = run([loadSucceeded(1)], loading);
    expect(stale).toBe(loading);
    expect(stale.undo).toHaveLength(1);
  });
});

// "Resetuj": everything the user set but the files, the names' language and the saved sets.
describe("settings reset", () => {
  it("restores the defaults, keeps the sets and the language, and can be taken back", () => {
    const set = run([
      goalkeepers,
      { type: "sort-changed", key: "age" },
      { type: "potential-shown", shown: true },
      { type: "language-chosen", language: "pol_pl" },
      { type: "filter-set-saved", name: "A" },
    ]);
    const reset = run([{ type: "settings-reset" }], set);
    expect(reset).toMatchObject({ filters: {}, sort: DEFAULT_SORT, showPotential: false });
    expect(reset.gameLanguage).toBe("pol_pl");
    expect(reset.filterSets?.map((each) => each.name)).toEqual(["A"]);
    const back = run([{ type: "undo" }], reset);
    expect(back).toMatchObject({ filters: goalkeepers.filters, showPotential: true });
    expect(back.sort.key).toBe("age");
  });
});
