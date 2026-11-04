import type { JSX } from "react";
import {
  lineOf,
  POSITION_GROUPS,
  positionCodesOf,
  positionOf,
  ratingChoiceOf,
  ratingCodeOf,
} from "../logic/positions.ts";
import { POSITION_GROUP_LABELS, TEXT } from "./text.ts";

/** A position's names in the chosen language: the abbreviation, and the full name where the game has one. */
export interface PositionNames {
  /** The abbreviation to choose a position by, with the English name where it could mislead. */
  readonly short: (code: number) => string;
  /** The game's own abbreviation, beside a full name that leaves no doubt. */
  readonly abbreviation: (code: number) => string;
  readonly full: (code: number) => string | undefined;
}

/** A position abbreviation in the colour of its line (--color-position-*), as in the game. */
export const PositionName = (props: { code: number; name: string }): JSX.Element => (
  <span className={`position position-${lineOf(props.code)}`}>{props.name}</span>
);

/** The groups a rating choice rates, in the groups' order. */
const choiceGroups = (code: number) =>
  POSITION_GROUPS.filter((group) =>
    positionCodesOf(group).some((other) => ratingCodeOf(other) === code),
  );

/**
 * The abbreviations naming a rating choice in the game language, group by group in the order of its
 * name: "ŚO", "PO/LO", "PS/LS; PP/LP".
 */
export const ratingAbbreviation = (
  code: number,
  positionName: (code: number) => string,
): string => {
  const codes = ratingChoiceOf(code);
  return choiceGroups(code)
    .map((group) =>
      codes
        .filter((other) => positionOf(other).group === group)
        .map(positionName)
        .join("/"),
    )
    .filter((names) => names !== "")
    .join("; ");
};

/** A rating choice by the groups it rates, such as "Skrzydłowy / boczny pomocnik". */
export const ratingChoiceName = (code: number): string =>
  TEXT.groupList(choiceGroups(code).map((group) => POSITION_GROUP_LABELS[group]));
