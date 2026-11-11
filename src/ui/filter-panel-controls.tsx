// The filter panel's own controls above the filters: the potential switch and, with a career, the
// switch to values after signing.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SigningState } from "../logic/signed-list.ts";
import { OptionalHelp } from "./field-help.tsx";
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

/**
 * Values after signing for players outside the squad (roadmap 56), under the potential switch and only
 * with a career; while the worker builds that list, and when it fails, a line under it says so.
 */
export const SigningSwitch = (props: {
  signing: SigningState;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { afterSigning, signed } = props.signing;
  const on = afterSigning === true;
  return (
    <div className="signing-switch">
      <div className="field-legend">
        <label className="check">
          <input
            type="checkbox"
            checked={on}
            onChange={(event) => {
              props.dispatch({ type: "after-signing-shown", shown: event.currentTarget.checked });
            }}
          />
          {TEXT.afterSigning.label}
        </label>
        <OptionalHelp label={TEXT.afterSigning.label} help={TEXT.afterSigning.help} />
      </div>
      <output className="signing-status">
        {on && signed === "pending" ? TEXT.afterSigning.pending : null}
        {on && signed === "failed" ? TEXT.afterSigning.failed : null}
      </output>
    </div>
  );
};
