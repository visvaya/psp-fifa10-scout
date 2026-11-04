import type { JSX } from "react";
import { lineOf } from "../logic/positions.ts";

/** A position abbreviation in the colour of its line (--color-position-*), as in the game. */
export const PositionName = (props: { code: number; name: string }): JSX.Element => (
  <span className="position" style={{ color: `var(--color-position-${lineOf(props.code)})` }}>
    {props.name}
  </span>
);
