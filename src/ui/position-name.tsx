import type { JSX } from "react";
import {
  lineOf,
  POSITION_GROUPS,
  positionCodesOf,
  ratingChoiceOf,
  ratingCodeOf,
} from "../logic/positions.ts";
import { POSITION_GROUP_LABELS, TEXT } from "./text.ts";

/** A position's names in the chosen language: the abbreviation, and the full name where the game has one. */
export interface PositionNames {
  /** The abbreviation to choose a position by (positionNameIn). */
  readonly short: (code: number) => string;
  readonly full: (code: number) => string | undefined;
}

/** A position abbreviation in the colour of its line (--color-position-*), as in the game. */
export const PositionName = (props: { code: number; name: string }): JSX.Element => (
  <span className={`position position-${lineOf(props.code)}`}>{props.name}</span>
);

/** The abbreviations naming a rating choice, such as "ŚO" or "PO/LO", in the game language. */
export const ratingAbbreviation = (code: number, positionName: (code: number) => string): string =>
  ratingChoiceOf(code).map(positionName).join("/");

/** A rating choice by the groups it rates, such as "Boczny pomocnik / skrzydłowy". */
export const ratingChoiceName = (code: number): string =>
  TEXT.groupList(
    POSITION_GROUPS.filter((group) =>
      positionCodesOf(group).some((other) => ratingCodeOf(other) === code),
    ).map((group) => POSITION_GROUP_LABELS[group]),
  );
