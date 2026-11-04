// The active filters as removable chips, one per filter, each with the value it takes.
import { useMemo } from "react";
import type { Dispatch, JSX } from "react";
import type { Player } from "../logic/players.ts";
import { activeFilters } from "../logic/scout-state.ts";
import type { ScoutAction, ScoutFilters } from "../logic/scout-state.ts";
import { chipText, namesById } from "./chip-text.ts";
import { TEXT } from "./text.ts";

export const FilterChips = (props: {
  filters: ScoutFilters;
  /** The loaded players, for the names of the chosen leagues, clubs and countries. */
  players: readonly Player[];
  positionName: (code: number) => string;
  /** Folded into one line that opens them, where the list needs the room (phones). */
  folded: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null => {
  const { players, positionName } = props;
  const names = useMemo(
    () => ({ positionName, byId: namesById(players) }),
    [players, positionName],
  );
  const ids = activeFilters(props.filters);
  if (ids.length === 0) return null;
  const chips = (
    <ul className="chips" aria-label={TEXT.activeFilters}>
      {ids.map((id) => {
        const text = chipText(id, props.filters, names);
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
