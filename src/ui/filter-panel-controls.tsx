// The filter panel's own control above the filters: the potential switch.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
import { TEXT } from "./text.ts";

/**
 * Shows the potential and its filters; set apart from the saved sets above it (owner, 2026-11-05). While
 * it is off, a line under it recommends it: the potential is what the game hides (owner, 2026-11-11).
 */
export const PotentialSwitch = (props: {
  shown: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const adviceId = useId();
  return (
    <div className="potential-switch">
      <label className="check">
        <input
          type="checkbox"
          checked={props.shown}
          aria-describedby={props.shown ? undefined : adviceId}
          onChange={(event) => {
            props.dispatch({ type: "potential-shown", shown: event.currentTarget.checked });
          }}
        />
        {TEXT.showPotential}
      </label>
      {props.shown ? null : (
        <p id={adviceId} className="potential-advice">
          <strong>{TEXT.showPotentialAdvice.lead}</strong> {TEXT.showPotentialAdvice.text}
        </p>
      )}
    </div>
  );
};
