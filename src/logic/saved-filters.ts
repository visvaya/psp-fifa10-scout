// Filter sets: the current filters and sort saved under a name, to load again later ("tanie perełki na
// LO"). Names are unique: saving under a taken name overwrites that set.
import type { Preferences, ScoutFilters, ScoutSort } from "./scout-state.ts";
import { POTENTIAL_KEYS } from "./sort-players.ts";

export interface FilterSet {
  readonly name: string;
  readonly filters: ScoutFilters;
  readonly sort: ScoutSort;
}

/** The sets with this one saved under its trimmed name: in place of a set of that name, else last. */
export const savedSet = (sets: readonly FilterSet[], set: FilterSet): readonly FilterSet[] => {
  const named = { ...set, name: set.name.trim() };
  if (named.name === "") return sets;
  return sets.some((each) => each.name === named.name)
    ? sets.map((each) => (each.name === named.name ? named : each))
    : [...sets, named];
};

/** The sets with one renamed in its place; an empty name or another set's name changes nothing. */
export const renamedSet = (
  sets: readonly FilterSet[],
  from: string,
  to: string,
): readonly FilterSet[] => {
  const name = to.trim();
  if (name === "" || sets.some((each) => each.name === name && each.name !== from)) return sets;
  return sets.map((each) => (each.name === from ? { ...each, name } : each));
};

export const withoutSet = (sets: readonly FilterSet[], name: string): readonly FilterSet[] =>
  sets.filter((each) => each.name !== name);

/** The set filters or sorts by a value that shows only with the potential. */
export const usesPotential = ({ filters, sort }: FilterSet): boolean =>
  POTENTIAL_KEYS.has(sort.key) ||
  Object.entries(filters.ranges ?? {}).some(
    ([key, range]) => range !== undefined && [...POTENTIAL_KEYS].some((each) => each === key),
  );

export type FilterSetAction =
  | { readonly type: "filter-set-saved"; readonly name: string }
  | { readonly type: "filter-set-loaded"; readonly name: string }
  | { readonly type: "filter-set-renamed"; readonly from: string; readonly to: string }
  | { readonly type: "filter-set-deleted"; readonly name: string };

/**
 * The preferences after saving, loading, renaming or deleting a set. Loading a set that needs the
 * potential shows it, rather than dropping part of the set.
 */
export const filterSetsAfter = (state: Preferences, action: FilterSetAction): Preferences => {
  const sets = state.filterSets ?? [];
  if (action.type === "filter-set-saved") {
    const { filters, sort } = state;
    return { ...state, filterSets: savedSet(sets, { name: action.name, filters, sort }) };
  }
  if (action.type === "filter-set-renamed") {
    return { ...state, filterSets: renamedSet(sets, action.from, action.to) };
  }
  if (action.type === "filter-set-deleted") {
    return { ...state, filterSets: withoutSet(sets, action.name) };
  }
  const set = sets.find((each) => each.name === action.name);
  if (set === undefined) return state;
  const showPotential = state.showPotential || usesPotential(set);
  return { ...state, filters: set.filters, sort: set.sort, showPotential };
};
