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

// The ids of the game's full position names (textKey), by code 0..31: texts 1592..1621. Codes 10, 12,
// 22 and 24 have none; RCF and LCF (1595, 1601) have no code.
// prettier-ignore
const NAME_TEXT_IDS: readonly (number | null)[] = [
  1592, 1621, 1607, 1599, 1600, 1605, 1594, 1593, 1608, 1610, null, 1611, null, 1612, 1613, 1604,
  1602, 1620, 1596, 1598, 1614, 1615, null, 1616, null, 1617, 1603, 1606, 1597, 1618, 1609, 1619,
];

/** The id of a position's full name in the game texts, or undefined for the codes it does not name. */
export const nameTextIdOf = (code: number): number | undefined => NAME_TEXT_IDS[code] ?? undefined;

/** Every preferred position code, 0..31. */
export const POSITION_CODES: readonly number[] = NAMES.map((_, code) => code);

// Each group: its codes, and the code its position rating is taken at (RATING_CHOICES).
const GROUPS: readonly (readonly [PositionGroup, readonly number[], number])[] = [
  ["goalkeeper", [0], 0],
  ["sweeper", [1], 1],
  ["wing-backs", [2, 8], 2],
  ["full-backs", [3, 7], 3],
  ["centre-backs", [4, 5, 6], 5],
  ["defensive-midfield", [9, 10, 11, 12, 13], 11],
  ["wingers", [14, 20], 15],
  ["side-midfield", [15, 19], 15],
  ["central-midfield", [16, 17, 18], 17],
  ["attacking-midfield", [21, 22, 23, 24, 25], 23],
  ["forwards", [26, 27, 28, 29, 30, 31], 30],
];

const groupOf = (code: number): (typeof GROUPS)[number] => {
  const entry = GROUPS.find(([, codes]) => codes.includes(code));
  if (entry === undefined) throw new SaveFormatError(`Unknown position code ${String(code)}`);
  return entry;
};

/**
 * The groups by their first code: the game lists positions in code order (its position names, the OVR
 * table and the scouting screen's costs), line by line from the goal, each line from the right wing.
 */
export const POSITION_GROUPS: readonly PositionGroup[] = GROUPS.map(([group]) => group);

/**
 * The game's position lines, as its screens colour positions (ClubPlayerList.apt,
 * ConvertPositionStringToColorId): goalkeeper 0, defence 1..8, midfield 9..25, attack 26..31.
 */
export type PositionLine = "goalkeeper" | "defence" | "midfield" | "attack";

const MIN_DEFENCE_CODE = 1;
const MIN_MIDFIELD_CODE = 9;
const MIN_ATTACK_CODE = 26;

export const lineOf = (code: number): PositionLine =>
  code < MIN_DEFENCE_CODE
    ? "goalkeeper"
    : code < MIN_MIDFIELD_CODE
      ? "defence"
      : code < MIN_ATTACK_CODE
        ? "midfield"
        : "attack";

/** The codes of a group, in code order. */
export const positionCodesOf = (group: PositionGroup): readonly number[] =>
  GROUPS.find(([candidate]) => candidate === group)?.[1] ?? [];

/**
 * The choices of the position rating filter, by the codes naming each: one per way the game rates a
 * position (its distinct OVR weight rows), in code order. The first code is the one rated and stored,
 * and its group names the choice; wingers rate as side midfielders.
 */
export const RATING_CHOICES: readonly (readonly [number, ...number[]])[] = [
  [0],
  [1],
  [2, 8],
  [3, 7],
  [5],
  [11],
  [15, 19],
  [17],
  [23],
  [30],
];

/** The codes naming the rating choice of a position code, rated the same way as it. */
export const ratingChoiceOf = (code: number): readonly [number, ...number[]] => {
  const ratedAt = groupOf(code)[2];
  return RATING_CHOICES.find(([first]) => first === ratedAt) ?? [ratedAt];
};

/** The code a position is rated and stored at: its rating choice's first code. */
export const ratingCodeOf = (code: number): number => groupOf(code)[2];

/** The short name and group of a preferred position code. */
export const positionOf = (code: number): { name: string; group: PositionGroup } => {
  const [group] = groupOf(code);
  // NAMES covers the same codes 0..31 as GROUPS.
  return { name: NAMES[code] ?? "", group };
};
