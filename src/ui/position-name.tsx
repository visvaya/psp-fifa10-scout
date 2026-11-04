import type { JSX } from "react";
import { lineOf, ratingChoiceOf } from "../logic/positions.ts";

/** A position abbreviation in the colour of its line (--color-position-*), as in the game. */
export const PositionName = (props: { code: number; name: string }): JSX.Element => (
  <span className={`position position-${lineOf(props.code)}`}>{props.name}</span>
);

/** The abbreviations naming a rating choice, such as "ŚO" or "PO/LO", in the game language. */
export const ratingAbbreviation = (code: number, positionName: (code: number) => string): string =>
  ratingChoiceOf(code).map(positionName).join("/");
