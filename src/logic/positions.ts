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
  ["full-backs", [3, 7]],
  ["wing-backs", [2, 8]],
  ["sweeper", [1]],
  ["centre-backs", [4, 5, 6]],
  ["defensive-midfield", [9, 10, 11, 12, 13]],
  ["central-midfield", [16, 17, 18]],
  ["attacking-midfield", [21, 22, 23, 24, 25]],
  ["side-midfield", [15, 19]],
  ["wingers", [14, 20]],
  ["forwards", [26, 27, 28, 29, 30, 31]],
];

/** The groups in the order the filter lists them, goalkeeper first. */
export const POSITION_GROUPS: readonly PositionGroup[] = GROUPS.map(([group]) => group);

/** The codes of a group, in code order. */
export const positionCodesOf = (group: PositionGroup): readonly number[] =>
  GROUPS.find(([candidate]) => candidate === group)?.[1] ?? [];

/**
 * The rows of OVR by group on the player card: a group with the groups it rates like. Wingers share
 * the side midfielders' weights; the sweeper's weights are the full-backs' in another order, which
 * changes the rounded OVR of 144 of the 26 090 fifa.db players.
 */
export const POSITION_GROUP_ROWS: readonly (readonly [PositionGroup, ...PositionGroup[]])[] = [
  ["goalkeeper"],
  ["full-backs", "sweeper"],
  ["wing-backs"],
  ["centre-backs"],
  ["defensive-midfield"],
  ["central-midfield"],
  ["attacking-midfield"],
  ["side-midfield", "wingers"],
  ["forwards"],
];

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
