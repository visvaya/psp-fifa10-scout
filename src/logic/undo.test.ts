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
