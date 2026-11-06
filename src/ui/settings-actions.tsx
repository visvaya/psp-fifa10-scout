// "Cofnij" and "Resetuj" for the user's settings: by the active filters and at the bottom of the filter
// panel. "Resetuj" asks first (owner, 2026-11-05) and names what it keeps.
import { useEffect, useRef, useState } from "react";
import type { Dispatch, JSX } from "react";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { canResetSettings } from "../logic/settings-reset.ts";
import type { ResetSettings } from "../logic/settings-reset.ts";
import { ConfirmQuestion } from "./confirm-question.tsx";
import { TEXT } from "./text.ts";

export type Settings = ResetSettings & Pick<ScoutState, "undo">;

export const SettingsActions = (props: {
  settings: Settings;
  className: string;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { settings, dispatch } = props;
  // "asking" while the question shows; then the focus goes back to a button that stays enabled.
  const [mode, setMode] = useState<"buttons" | "asking" | "reset" | "kept">("buttons");
  const undo = useRef<HTMLButtonElement>(null);
  const reset = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (mode === "reset") undo.current?.focus();
    if (mode === "kept") reset.current?.focus();
  }, [mode]);
  if (mode === "asking") {
    return (
      <div className={props.className}>
        <ConfirmQuestion
          question={TEXT.resetQuestion}
          confirmLabel={TEXT.resetSettings}
          questionClassName="settings-question"
          onAnswer={(confirmed) => {
            if (confirmed) dispatch({ type: "settings-reset" });
            setMode(confirmed ? "reset" : "kept");
          }}
        />
      </div>
    );
  }
  return (
    <div className={props.className}>
      <button
        ref={undo}
        type="button"
        className="button"
        disabled={settings.undo.length === 0}
        onClick={() => {
          dispatch({ type: "undo" });
        }}
      >
        {TEXT.undo}
      </button>
      <button
        ref={reset}
        type="button"
        className="button"
        disabled={!canResetSettings(settings)}
        onClick={() => {
          setMode("asking");
        }}
      >
        {TEXT.resetSettings}
      </button>
    </div>
  );
};
