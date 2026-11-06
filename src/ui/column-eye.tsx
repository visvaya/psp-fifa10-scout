// The eye beside a filter's name: it shows the filter's column in the list, or hides it.
import type { JSX } from "react";
import type { SortKey } from "../logic/sort-players.ts";
import { TEXT } from "./text.ts";

export interface ColumnToggle {
  /** The column is in the list now. */
  readonly visible: boolean;
  readonly onToggle: () => void;
}

/** The eye of a filter's column; undefined for a filter without one. */
export type Eye = (key: SortKey | undefined) => ColumnToggle | undefined;

/** An eye, crossed out for a hidden column; drawn in the text colour. */
const EyeIcon = ({ crossed }: { crossed: boolean }) => (
  <svg className="column-eye-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {crossed ? <path d="M4 20L20 4" /> : null}
  </svg>
);

/** A toggle named after the filter, pressed while its column shows. */
export const ColumnEye = (props: { label: string } & ColumnToggle): JSX.Element => (
  <button
    type="button"
    className="column-eye"
    aria-label={TEXT.columnToggleLabel(props.label)}
    aria-pressed={props.visible}
    onClick={props.onToggle}
  >
    <EyeIcon crossed={!props.visible} />
  </button>
);
