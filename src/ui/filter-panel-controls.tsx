// The filter panel's own controls above the filters: the potential switch, with the game's graphics the
// approximate portraits switch and, with a career, the switch to values after signing.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SigningState } from "../logic/signed-list.ts";
import { OptionalHelp } from "./field-help.tsx";
import { useHasGameImages } from "./game-image.tsx";
import { TEXT } from "./text.ts";
import { PORTRAIT_TEXT } from "./text-portraits.ts";
import { SIGNING_TEXT } from "./text-signing.ts";

/** A switch of the panel with its explanation behind a "?". */
const HelpedSwitch = (props: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element => (
  <div className="field-legend">
    <label className="check">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => {
          props.onChange(event.currentTarget.checked);
        }}
      />
      {props.label}
    </label>
    <OptionalHelp label={props.label} help={props.help} />
  </div>
);

/**
 * A lookalike's portrait for the players the game has none of (roadmap 110), off by default; only
 * with the game's graphics.
 */
export const PortraitSwitch = (props: {
  shown: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null =>
  useHasGameImages() ? (
    <HelpedSwitch
      label={PORTRAIT_TEXT.label}
      help={PORTRAIT_TEXT.help}
      checked={props.shown}
      onChange={(shown) => {
        props.dispatch({ type: "approximate-portraits-shown", shown });
      }}
    />
  ) : null;

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
      <HelpedSwitch
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
