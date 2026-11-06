// The user's choice of columns, over what the filters and the sort show on their own (columns.ts). A view
// setting: it is not a filter, so it stays out of the filter sets and the undo steps.
import type { ScoutAction, ScoutState } from "./scout-state.ts";
import type { SortKey } from "./sort-players.ts";

/** Columns the user turned on or off, the latest change last. */
export type ColumnPreference = Partial<Record<SortKey, "shown" | "hidden">>;

export type ColumnAction = {
  readonly type: "column-shown";
  readonly key: SortKey;
  readonly shown: boolean;
  /** The column is in the automatic choice: a change that agrees with it is no choice, so it is dropped. */
  readonly automatic: boolean;
};

export const isColumnAction = (action: ScoutAction): action is ColumnAction =>
  action.type === "column-shown";

export const columnReducer = (state: ScoutState, action: ColumnAction): ScoutState => {
  // Moved to the end, so a column turned on again follows the ones turned on since.
  const { [action.key]: _was, ...others } = state.columns ?? {};
  const choice = action.shown ? "shown" : "hidden";
  return {
    ...state,
    columns: action.shown === action.automatic ? others : { ...others, [action.key]: choice },
  };
};
