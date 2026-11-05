// The filter panel's own controls around the filters: the potential switch and the reset button.
import type { Dispatch, JSX } from "react";
import { activeFilters } from "../logic/scout-state.ts";
import type { ScoutAction, ScoutFilters } from "../logic/scout-state.ts";
import { TEXT } from "./text.ts";

/** Shows the potential and its filters; set apart from the saved sets above it (owner, 2026-11-05). */
export const PotentialSwitch = (props: {
  shown: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => (
  <label className="check potential-switch">
    <input
      type="checkbox"
      checked={props.shown}
      onChange={(event) => {
        props.dispatch({ type: "potential-shown", shown: event.currentTarget.checked });
      }}
    />
    {TEXT.showPotential}
  </label>
);

/**
 * Takes back the last change and clears every filter; they stay at the bottom of the panel while the
 * panel scrolls.
 */
export const ResetFilters = (props: {
  filters: ScoutFilters;
  canUndo: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => (
  <div className="reset-filters">
    <button
      type="button"
      className="button"
      disabled={!props.canUndo}
      onClick={() => {
        props.dispatch({ type: "undo" });
      }}
    >
      {TEXT.undo}
    </button>
    <button
      type="button"
      className="button"
      disabled={activeFilters(props.filters).length === 0}
      onClick={() => {
        props.dispatch({ type: "filters-reset" });
      }}
    >
      {TEXT.resetFilters}
    </button>
  </div>
);
