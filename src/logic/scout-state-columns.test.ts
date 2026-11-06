import { describe, expect, it } from "vitest";
import { effectiveColumns } from "./columns.ts";
import { phoneColumns } from "./phone-columns.ts";
import { DEFAULT_SORT, initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";
import type { SortKey } from "./sort-players.ts";

const run = (actions: readonly ScoutAction[], from: ScoutState = initialScoutState): ScoutState =>
  actions.reduce(scoutReducer, from);

/** The user's change of a column; automatic: the filters and the sort show it without a choice. */
const turn = (key: SortKey, shown: boolean, automatic = false): ScoutAction => ({
  type: "column-shown",
  key,
  shown,
  automatic,
});

describe("column visibility", () => {
  it("records what the user turned on or off, the latest change last", () => {
    const state = run([
      turn("clubName", true),
      turn("dribbling", false, true),
      turn("height", true),
      turn("clubName", false),
      turn("clubName", true),
    ]);
    expect(state.columns).toEqual({ dribbling: "hidden", height: "shown", clubName: "shown" });
    expect(Object.keys(state.columns ?? {})).toEqual(["dribbling", "height", "clubName"]);
  });

  it("drops a choice that agrees with the automatic one, back to as it was", () => {
    // A column no filter asks for: shown, then hidden again.
    expect(run([turn("height", true), turn("height", false)]).columns).toEqual({});
    // A ranged column: hidden, then shown again.
    expect(run([turn("dribbling", false, true), turn("dribbling", true, true)]).columns).toEqual(
      {},
    );
    // The others' choices stay.
    expect(
      run([turn("weight", true), turn("height", true), turn("height", false)]).columns,
    ).toEqual({ weight: "shown" });
  });

  it("lets a range filter add a column again after it was shown and hidden", () => {
    const state = run([turn("height", true), turn("height", false)]);
    const columns = (ranges: Parameters<typeof phoneColumns>[0]["ranges"]) =>
      effectiveColumns(
        phoneColumns({
          showPotential: false,
          ratingCode: null,
          ratingPeakSet: false,
          ranges,
          sortKey: "name",
        }),
        state.columns,
        { showPotential: false, ratingCode: null, career: false },
      );
    expect(columns({})).toEqual(["overall"]);
    expect(columns({ height: { min: 180 } })).toEqual(["overall", "height"]);
  });

  it("is a view setting: no undo step, kept by the filter reset, not part of the filters", () => {
    const set = run([turn("weight", true)]);
    expect(set.undo).toEqual([]);
    const filtered = run(
      [
        { type: "filters-changed", filters: { ranges: { age: { max: 20 } } } },
        { type: "sort-changed", key: "age" },
      ],
      set,
    );
    expect(run([{ type: "filters-reset" }], filtered)).toMatchObject({
      columns: { weight: "shown" },
      filters: {},
      sort: DEFAULT_SORT,
    });
    // "Cofnij" brings back the filters and the sort, not the column.
    const undone = run([{ type: "undo" }, { type: "undo" }], filtered);
    expect(undone.columns).toEqual({ weight: "shown" });
    expect(undone.filters).toEqual({});
  });

  it("is cleared by Resetuj, which brings every setting back", () => {
    const set = run([
      turn("weight", true),
      turn("potential", true),
      { type: "sort-changed", key: "age" },
    ]);
    const reset = run([{ type: "settings-reset" }], set);
    expect(reset).not.toHaveProperty("columns");
    expect(reset.sort).toEqual(DEFAULT_SORT);
    // Nothing was set: the reset leaves the state without the field too.
    expect(run([{ type: "settings-reset" }])).not.toHaveProperty("columns");
  });

  it("comes back with the restored preferences, and stays as it is without them", () => {
    const base = { filters: {}, sort: DEFAULT_SORT, showPotential: false } as const;
    const columns = { clubName: "shown", dribbling: "hidden" } as const;
    expect(
      run([{ type: "preferences-restored", preferences: { ...base, columns } }]).columns,
    ).toEqual(columns);
    const set = run([turn("weight", true)]);
    expect(run([{ type: "preferences-restored", preferences: base }], set).columns).toEqual({
      weight: "shown",
    });
  });
});
