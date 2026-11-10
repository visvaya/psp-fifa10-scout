// The eye beside a filter's name: it shows the filter's column in the list, or hides it.
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { TEXT } from "./text.ts";

export interface ColumnToggle {
  /** The column is in the list now. */
  readonly visible: boolean;
  /** The user turned the column on: the filters and the sort alone would not show it. */
  readonly chosen: boolean;
  readonly onToggle: () => void;
  /** Drops the user's choice, so the column shows as the filters and the sort decide. */
  readonly onReset: () => void;
}

/** The eye of a filter's column; undefined for a filter without one. */
export type Eye = (key: SortKey | undefined) => ColumnToggle | undefined;

/** The eyes of the filters, open for the columns the list shows. */
export const columnEye =
  (
    columns: readonly SortKey[],
    automatic: readonly SortKey[],
    dispatch: Dispatch<ScoutAction>,
  ): Eye =>
  (key) => {
    if (key === undefined) return undefined;
    const visible = columns.includes(key);
    return {
      visible,
      chosen: visible && !automatic.includes(key),
      onToggle: () => {
        dispatch({
          type: "column-shown",
          key,
          shown: !visible,
          automatic: automatic.includes(key),
        });
      },
      // A change that agrees with the automatic choice stores nothing and drops the earlier choice.
      onReset: () => {
        dispatch({ type: "column-shown", key, shown: false, automatic: false });
      },
    };
  };

/** An eye, crossed out for a hidden column; drawn in the text colour. */
const EyeIcon = ({ crossed }: { crossed: boolean }) => (
  <svg className="column-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {crossed ? <path d="M4 20L20 4" /> : null}
  </svg>
);

/** A toggle named after the filter, pressed while its column shows; nothing for a filter without one. */
export const ColumnEye = (props: {
  label: string;
  column: ColumnToggle | undefined;
}): JSX.Element | null =>
  props.column === undefined ? null : (
    <button
      type="button"
      className="column-eye"
      aria-label={TEXT.columnToggleLabel(props.label)}
      aria-pressed={props.column.visible}
      onClick={props.column.onToggle}
    >
      <EyeIcon crossed={!props.column.visible} />
    </button>
  );
