// "Cofnij" and "Resetuj" for the user's settings: by the active filters and at the bottom of the filter
// panel. "Resetuj" asks first (owner, 2026-11-05) and names what it keeps.
import { useEffect, useRef, useState } from "react";
import type { Dispatch, JSX } from "react";
import { activeFilters, DEFAULT_SORT } from "../logic/scout-state.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { ConfirmQuestion } from "./confirm-question.tsx";
import { TEXT } from "./text.ts";

type Settings = Pick<ScoutState, "filters" | "sort" | "showPotential" | "columns" | "undo">;

/** Something differs from the defaults the reset brings back. */
const resettable = ({ filters, sort, showPotential, columns }: Settings): boolean =>
  activeFilters(filters).length > 0 ||
  Object.keys(columns ?? {}).length > 0 ||
  sort.key !== DEFAULT_SORT.key ||
  sort.direction !== DEFAULT_SORT.direction ||
  showPotential;

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
        disabled={!resettable(settings)}
        onClick={() => {
          setMode("asking");
        }}
      >
        {TEXT.resetSettings}
      </button>
    </div>
  );
};
