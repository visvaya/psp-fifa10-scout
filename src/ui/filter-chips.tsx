// The active filters as removable chips, one per filter, with yes or no for a trait.
import type { Dispatch, JSX } from "react";
import { FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "../logic/filter-players.ts";
import { activeFilters } from "../logic/scout-state.ts";
import type { FilterId, ScoutAction, ScoutFilters } from "../logic/scout-state.ts";
import { FLAG_LABELS, LIST_LABELS, MY_CLUB_LABELS, rangeLabel, TEXT } from "./text.ts";

const FILTER_LABELS = new Map<FilterId, string>([
  ["text", TEXT.text],
  ["clubStatus", TEXT.clubStatus],
  ["myClub", TEXT.myClub],
  ["positionRating", TEXT.positionRating],
  ...RANGE_KEYS.map((key) => [`ranges.${key}`, rangeLabel(key)] as const),
  ...LIST_FIELDS.map((key) => [`lists.${key}`, LIST_LABELS[key]] as const),
  ...FLAG_KEYS.map((key) => [`flags.${key}`, FLAG_LABELS[key]] as const),
]);

/** The chip text: the filter's name, with yes or no for a trait; the chosen option for "my club". */
const chipText = (id: FilterId, filters: ScoutFilters): string => {
  if (id === "myClub" && filters.myClub !== undefined) return MY_CLUB_LABELS[filters.myClub];
  const label = FILTER_LABELS.get(id) ?? id;
  const flag = FLAG_KEYS.find((key) => `flags.${key}` === id);
  const wanted = flag === undefined ? undefined : filters.flags?.[flag];
  return wanted === undefined ? label : TEXT.flagChip(label, wanted);
};

export const FilterChips = (props: {
  filters: ScoutFilters;
  /** Folded into one line that opens them, where the list needs the room (phones). */
  folded: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null => {
  const ids = activeFilters(props.filters);
  if (ids.length === 0) return null;
  const chips = (
    <ul className="chips" aria-label={TEXT.activeFilters}>
      {ids.map((id) => {
        const text = chipText(id, props.filters);
        return (
          <li key={id}>
            <button
              type="button"
              className="chip"
              aria-label={TEXT.removeFilter(text)}
              onClick={() => {
                props.dispatch({ type: "filter-removed", id });
              }}
            >
              {text}
              <span aria-hidden="true">{TEXT.removeMark}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
  return props.folded ? (
    <details className="chips-fold">
      <summary>{TEXT.activeFiltersCount(ids.length)}</summary>
      {chips}
    </details>
  ) : (
    chips
  );
};
