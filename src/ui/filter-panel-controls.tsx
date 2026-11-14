// The filter panel's own controls above the filters: the potential switch, with the game's graphics the
// portrait switches and, with a career, the switch to values after signing.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import { CheckField } from "./filter-fields.tsx";
import { useHasGameImages } from "./game-image.tsx";
import type { PortraitSetting, ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { useMediaQuery, WIDE_QUERY } from "./use-media-query.ts";
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
 * The portrait switches, off by default and only with the game's graphics: a lookalike's portrait for
 * the players the game has none of (roadmap 110), and portraits beside any columns of the phone list
 * (117), which only the narrow layout has: the wide table always shows them.
 */
export const PortraitSwitches = (props: {
  settings: Pick<ScoutState, PortraitSetting>;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element | null => {
  const wide = useMediaQuery(WIDE_QUERY);
  const settings: readonly PortraitSetting[] = wide
    ? ["approximatePortraits"]
    : ["approximatePortraits", "alwaysPortraits"];
  return useHasGameImages() ? (
    <>
      {settings.map((setting) => (
        <CheckField
          key={setting}
          label={PORTRAIT_TEXT.switches[setting].label}
          help={PORTRAIT_TEXT.switches[setting].help}
          checked={props.settings[setting] === true}
          onChange={(on) => {
            props.dispatch({ type: "portraits-chosen", setting, on });
          }}
        />
      ))}
    </>
  ) : null;
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
