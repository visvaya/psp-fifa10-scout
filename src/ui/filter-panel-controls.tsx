// The filter panel's own controls above the filters: the potential switch, with the game's graphics the
// approximate portraits switch and, with a career, the switch to values after signing.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import { CheckField } from "./filter-fields.tsx";
import { useHasGameImages } from "./game-image.tsx";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SigningState } from "../logic/signed-list.ts";
import { TEXT } from "./text.ts";
import { PORTRAIT_TEXT } from "./text-portraits.ts";
import { SIGNING_TEXT } from "./text-signing.ts";

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
 * A lookalike's portrait for the players the game has none of (roadmap 110), off by default; only
 * with the game's graphics.
 */
export const PortraitSwitch = (props: {
  shown: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null =>
  useHasGameImages() ? (
    <CheckField
      label={PORTRAIT_TEXT.label}
      help={PORTRAIT_TEXT.help}
      checked={props.shown}
      onChange={(shown) => {
        props.dispatch({ type: "approximate-portraits-shown", shown });
      }}
    />
  ) : null;

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
      <CheckField
        label={SIGNING_TEXT.label}
        help={SIGNING_TEXT.help}
        checked={on}
        onChange={(shown) => {
          props.dispatch({ type: "after-signing-shown", shown });
        }}
      />
      <output className="signing-status">
        {on && signed === "pending" ? SIGNING_TEXT.pending : null}
        {on && signed === "failed" ? SIGNING_TEXT.failed : null}
      </output>
    </div>
  );
};
