// Undo for what the user sets: the filters, the sort, the potential switch and the saved sets. Each change
// the user makes keeps the state before it; "undo" brings the last one back. Loading files, restoring
// stored preferences and opening a card are not steps.
import { SCOUT_CONFIG } from "./config.ts";
import type { FilterSet } from "./saved-filters.ts";
import type { Preferences, ScoutAction, ScoutState } from "./scout-state.ts";

export interface UndoStep extends Pick<Preferences, "filters" | "sort" | "showPotential"> {
  readonly filterSets: readonly FilterSet[];
}

export type UndoAction = { readonly type: "undo" };

/** The user's own changes; anything else is not a step. */
const UNDOABLE: ReadonlySet<ScoutAction["type"]> = new Set([
  "filters-changed",
  "filter-removed",
  "filters-reset",
  "sort-changed",
  "potential-shown",
  "filter-set-saved",
  "filter-set-loaded",
  "filter-set-renamed",
  "filter-set-deleted",
]);

const stepOf = ({ filters, sort, showPotential, filterSets }: ScoutState): UndoStep => ({
  filters,
  sort,
  showPotential,
  filterSets: filterSets ?? [],
});

const same = (a: UndoStep, b: UndoStep): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The reducer with undo: steps kept newest first, at most SCOUT_CONFIG.undoSteps of them. */
export const withUndo =
  (reducer: (state: ScoutState, action: Exclude<ScoutAction, UndoAction>) => ScoutState) =>
  (state: ScoutState, action: ScoutAction): ScoutState => {
    if (action.type === "undo") {
      const [last, ...older] = state.undo;
      return last === undefined ? state : { ...state, ...last, undo: older };
    }
    const next = reducer(state, action);
    const before = stepOf(state);
    if (!UNDOABLE.has(action.type) || same(before, stepOf(next))) return next;
    return { ...next, undo: [before, ...state.undo].slice(0, SCOUT_CONFIG.undoSteps) };
  };
