// FIFA 10 (PSP) position codes 0..31 (players.preferredposition1) and their groups; the codes of a group
// share their OVR weights. Codes 32/33 (SUB/RES) exist only in team sheets and are no preferred position.
import { SaveFormatError } from "../data/save-format-error.ts";

export type PositionGroup =
  | "goalkeeper"
  | "full-backs"
  | "wing-backs"
  | "sweeper"
  | "centre-backs"
  | "defensive-midfield"
  | "central-midfield"
  | "attacking-midfield"
  | "side-midfield"
  | "wingers"
  | "forwards";

// The game's own names in code order (a list in its code); each language's abbreviation is keyed by
// the name (labelKey), so they double as the English labels.
const NAMES = (
  "GK SW RWB RB RCB CB LCB LB LWB RDM RCDM CDM LCDM LDM RWM RM RCM CM LCM LM LWM " +
  "RAM RCAM CAM LCAM LAM RF CF LF RS ST LS"
).split(" ");

/** Every preferred position code, 0..31. */
export const POSITION_CODES: readonly number[] = NAMES.map((_, code) => code);

const GROUPS: readonly (readonly [PositionGroup, readonly number[]])[] = [
  ["goalkeeper", [0]],
  ["sweeper", [1]],
  ["wing-backs", [2, 8]],
  ["full-backs", [3, 7]],
  ["centre-backs", [4, 5, 6]],
  ["defensive-midfield", [9, 10, 11, 12, 13]],
  ["wingers", [14, 20]],
  ["side-midfield", [15, 19]],
  ["central-midfield", [16, 17, 18]],
  ["attacking-midfield", [21, 22, 23, 24, 25]],
  ["forwards", [26, 27, 28, 29, 30, 31]],
];

/**
 * The groups by their first code: the game lists positions in code order (its position names, the OVR
 * table and the scouting screen's costs), line by line from the goal, each line from the right wing.
 */
export const POSITION_GROUPS: readonly PositionGroup[] = GROUPS.map(([group]) => group);

/** The codes of a group, in code order. */
export const positionCodesOf = (group: PositionGroup): readonly number[] =>
  GROUPS.find(([candidate]) => candidate === group)?.[1] ?? [];

/**
 * The rows of OVR by group on the player card, in the groups' order: a group, which names the row,
 * with the groups it rates like. Wingers share the side midfielders' weights; the sweeper's weights
 * are the full-backs' in another order, which changes the rounded OVR of 144 of the 26 090 fifa.db
 * players.
 */
export const POSITION_GROUP_ROWS: readonly (readonly [PositionGroup, ...PositionGroup[]])[] = [
  ["goalkeeper"],
  ["full-backs", "sweeper"],
  ["wing-backs"],
  ["centre-backs"],
  ["defensive-midfield"],
  ["side-midfield", "wingers"],
  ["central-midfield"],
  ["attacking-midfield"],
  ["forwards"],
];

/** A card row's OVR: its first group's, approximate where another group of the row rates otherwise. */
export const rowRating = (
  ratings: Readonly<Record<PositionGroup, number>>,
  row: readonly [PositionGroup, ...PositionGroup[]],
): { value: number; approximate: boolean } => {
  const value = ratings[row[0]];
  return { value, approximate: row.some((group) => ratings[group] !== value) };
};

/** A value per position group, from one code of the group (its codes share their OVR weights). */
export const byGroup = <T>(value: (code: number) => T): Readonly<Record<PositionGroup, T>> => ({
  goalkeeper: value(0),
  "full-backs": value(3),
  "wing-backs": value(2),
  sweeper: value(1),
  "centre-backs": value(5),
  "defensive-midfield": value(11),
  "central-midfield": value(17),
  "attacking-midfield": value(23),
  "side-midfield": value(15),
  wingers: value(14),
  forwards: value(30),
});

/** The short name and group of a preferred position code. */
export const positionOf = (code: number): { name: string; group: PositionGroup } => {
  const group = GROUPS.find(([, codes]) => codes.includes(code))?.[0];
  if (group === undefined) throw new SaveFormatError(`Unknown position code ${String(code)}`);
  // NAMES covers the same codes 0..31 as GROUPS.
  return { name: NAMES[code] ?? "", group };
};
