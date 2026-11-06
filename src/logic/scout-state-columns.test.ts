import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";

const run = (actions: readonly ScoutAction[], from: ScoutState = initialScoutState): ScoutState =>
  actions.reduce(scoutReducer, from);

describe("column visibility", () => {
  it("records what the user turned on or off, the latest change last", () => {
    const state = run([
      { type: "column-shown", key: "clubName", shown: true },
      { type: "column-shown", key: "dribbling", shown: false },
      { type: "column-shown", key: "height", shown: true },
      { type: "column-shown", key: "clubName", shown: false },
      { type: "column-shown", key: "clubName", shown: true },
    ]);
    expect(state.columns).toEqual({ dribbling: "hidden", height: "shown", clubName: "shown" });
    expect(Object.keys(state.columns ?? {})).toEqual(["dribbling", "height", "clubName"]);
  });

  it("is a view setting: no undo step, kept by the resets, not part of the filters", () => {
    const set = run([{ type: "column-shown", key: "weight", shown: true }]);
    expect(set.undo).toEqual([]);
    const filtered = run(
      [
        { type: "filters-changed", filters: { ranges: { age: { max: 20 } } } },
        { type: "sort-changed", key: "age" },
      ],
      set,
    );
    for (const type of ["filters-reset", "settings-reset"] as const) {
      expect(run([{ type }], filtered)).toMatchObject({
        columns: { weight: "shown" },
        filters: {},
        sort: DEFAULT_SORT,
      });
    }
    // "Cofnij" brings back the filters and the sort, not the column.
    const undone = run([{ type: "undo" }, { type: "undo" }], filtered);
    expect(undone.columns).toEqual({ weight: "shown" });
    expect(undone.filters).toEqual({});
  });

  it("comes back with the restored preferences, and stays as it is without them", () => {
    const base = { filters: {}, sort: DEFAULT_SORT, showPotential: false } as const;
    const columns = { clubName: "shown", dribbling: "hidden" } as const;
    expect(
      run([{ type: "preferences-restored", preferences: { ...base, columns } }]).columns,
    ).toEqual(columns);
    const set = run([{ type: "column-shown", key: "weight", shown: true }]);
    expect(run([{ type: "preferences-restored", preferences: base }], set).columns).toEqual({
      weight: "shown",
    });
  });
});
