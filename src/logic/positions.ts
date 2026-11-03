// FIFA 10 (PSP) position codes 0..31 (players.preferredposition1) and their groups, as in the
// OVR weight table. Codes 32/33 (SUB/RES) exist only in team sheets and are no preferred position.
import { SaveFormatError } from "../data/save-format-error.ts";

export type PositionGroup =
  | "goalkeeper"
  | "full-backs"
  | "wing-backs"
  | "centre-backs"
  | "defensive-midfield"
  | "wide"
  | "central-midfield"
  | "attacking-midfield"
  | "forwards";

// Codes 10, 12, 22 and 24 have no confirmed name: they are named after their group plus the code.
const NAMES = (
  "GK SW RWB RB RCB CB LCB LB LWB RDM DM10 CDM DM12 LDM RW RM RCM CM LCM LM LW " +
  "RAM AM22 CAM AM24 LAM RF CF LF RS ST LS"
).split(" ");

const GROUPS: readonly (readonly [PositionGroup, readonly number[]])[] = [
  ["goalkeeper", [0]],
  ["full-backs", [1, 3, 7]],
  ["wing-backs", [2, 8]],
  ["centre-backs", [4, 5, 6]],
  ["defensive-midfield", [9, 10, 11, 12, 13]],
  ["wide", [14, 15, 19, 20]],
  ["central-midfield", [16, 17, 18]],
  ["attacking-midfield", [21, 22, 23, 24, 25]],
  ["forwards", [26, 27, 28, 29, 30, 31]],
];

/** The groups in pitch order, goalkeeper first. */
export const POSITION_GROUPS: readonly PositionGroup[] = GROUPS.map(([group]) => group);

/** A value per position group, from one code of the group (its codes share their OVR weights). */
export const byGroup = <T>(value: (code: number) => T): Readonly<Record<PositionGroup, T>> => ({
  goalkeeper: value(0),
  "full-backs": value(3),
  "wing-backs": value(2),
  "centre-backs": value(5),
  "defensive-midfield": value(11),
  wide: value(15),
  "central-midfield": value(17),
  "attacking-midfield": value(23),
  forwards: value(30),
});

/** The short name and group of a preferred position code. */
export const positionOf = (code: number): { name: string; group: PositionGroup } => {
  const group = GROUPS.find(([, codes]) => codes.includes(code))?.[0];
  if (group === undefined) throw new SaveFormatError(`Unknown position code ${String(code)}`);
  // NAMES covers the same codes 0..31 as GROUPS.
  return { name: NAMES[code] ?? "", group };
};
