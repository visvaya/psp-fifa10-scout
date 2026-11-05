// Undo for what the user sets: the filters, the sort, the potential switch and the saved sets. Each change
// the user makes keeps the state before it; "undo" brings the last one back. Loading files, restoring
// stored preferences and opening a card are not steps, and a loaded game or restored preferences start
// the steps afresh.
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
  "settings-reset",
  "sort-changed",
  "potential-shown",
  "filter-set-saved",
  "filter-set-loaded",
  "filter-set-renamed",
  "filter-set-deleted",
]);

/** Actions after which no earlier step applies. */
const FRESH_START: ReadonlySet<ScoutAction["type"]> = new Set([
  "load-succeeded",
  "preferences-restored",
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
    // A loaded game or restored preferences replace the context the steps were taken in: a step from
    // before could bring back a filter the new game cannot show, or undo the restored preferences.
    // A superseded load leaves the state as it was, steps included.
    if (FRESH_START.has(action.type)) {
      return next === state || next.undo.length === 0 ? next : { ...next, undo: [] };
    }
    const before = stepOf(state);
    if (!UNDOABLE.has(action.type) || same(before, stepOf(next))) return next;
    return { ...next, undo: [before, ...state.undo].slice(0, SCOUT_CONFIG.undoSteps) };
  };
