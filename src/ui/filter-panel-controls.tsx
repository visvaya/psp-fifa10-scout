// The filter panel's own control above the filters: the potential switch.
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
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
