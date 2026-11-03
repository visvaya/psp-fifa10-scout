// Overall rating (OVR) as FIFA 10 (PSP) computes it: a weighted sum of seven attributes or fewer per
// position code, and in career mode each attribute first aged along a development curve.
//
// Source of the weights: the game executable ULES01328 (decrypted EBOOT.BIN), file offset 0x6A34F0
// (vaddr 0x08EA73F0): 32 position slots of 7 pairs (u32 attribute id, f32 weight), unused pairs
// with id -1. The numbers below are the stored float32 values, written so that Math.fround gives
// back the stored value; slots with identical contents share a row here, in the game's pair order.
// The routine at vaddr 0x089B6764 was decoded by hand, and this module reproduces 302 of 326 stored
// ratings of a real career save exactly at the preferred position (the user squad 23 of 23).
import type { CareerSave } from "../data/career-save.ts";
import { effectiveRows } from "../data/career-save.ts";
import { readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import type { AttributeName, Attributes } from "./players.ts";

type WeightRow = readonly (readonly [AttributeName, number])[];

// Data rows, alike by nature. jscpd:ignore-start
const GOALKEEPER: WeightRow = [
  ["handling", 0.225],
  ["reflexes", 0.225],
  ["gkpositioning", 0.225],
  ["strength", 0.1],
  ["gkdiving", 0.225],
];
const FULL_BACK: WeightRow = [
  ["tackling", 0.2],
  ["marking", 0.2],
  ["heading", 0.1],
  ["ballcontrol", 0.2],
  ["shortpassing", 0.1],
  ["strength", 0.1],
  ["stamina", 0.1],
];
// Slot 1 (SW) lists shortpassing before ballcontrol; the other full-back slots the other way round.
const SWEEPER: WeightRow = [
  ["tackling", 0.2],
  ["marking", 0.2],
  ["heading", 0.1],
  ["shortpassing", 0.1],
  ["ballcontrol", 0.2],
  ["strength", 0.1],
  ["stamina", 0.1],
];
const WING_BACK: WeightRow = [
  ["tackling", 0.2],
  ["marking", 0.2],
  ["ballcontrol", 0.2],
  ["shortpassing", 0.1],
  ["crossing", 0.1],
  ["sprintspeed", 0.1],
  ["stamina", 0.1],
];
const CENTRE_BACK: WeightRow = [
  ["tackling", 0.25],
  ["marking", 0.25],
  ["heading", 0.2],
  ["ballcontrol", 0.1],
  ["strength", 0.1],
  ["stamina", 0.1],
];
const DEFENSIVE_MIDFIELD: WeightRow = [
  ["ballcontrol", 0.2],
  ["dribbling", 0.1],
  ["shortpassing", 0.2],
  ["heading", 0.1],
  ["tackling", 0.2],
  ["strength", 0.1],
  ["stamina", 0.1],
];
const WIDE: WeightRow = [
  ["ballcontrol", 0.18],
  ["dribbling", 0.19],
  ["shortpassing", 0.18],
  ["crossing", 0.25],
  ["sprintspeed", 0.1],
  ["stamina", 0.1],
];
const CENTRAL_MIDFIELD: WeightRow = [
  ["ballcontrol", 0.225],
  ["dribbling", 0.125],
  ["longpassing", 0.125],
  ["shortpassing", 0.225],
  ["tackling", 0.1],
  ["strength", 0.1],
  ["stamina", 0.1],
];
const ATTACKING_MIDFIELD: WeightRow = [
  ["ballcontrol", 0.15],
  ["dribbling", 0.15],
  ["longpassing", 0.1],
  ["shortpassing", 0.25],
  ["finishing", 0.15],
  ["sprintspeed", 0.1],
  ["stamina", 0.1],
];
const FORWARD: WeightRow = [
  ["ballcontrol", 0.167],
  ["dribbling", 0.1],
  ["finishing", 0.267],
  ["shotpower", 0.266],
  ["sprintspeed", 0.1],
  ["stamina", 0.1],
];
// jscpd:ignore-end

/** The weight row of each position code 0..31, as stored in the game. */
export const OVR_WEIGHTS: readonly WeightRow[] = [
  [GOALKEEPER],
  [SWEEPER],
  [WING_BACK, FULL_BACK],
  [CENTRE_BACK, CENTRE_BACK, CENTRE_BACK, FULL_BACK, WING_BACK],
  Array.from({ length: 5 }, () => DEFENSIVE_MIDFIELD),
  [WIDE, WIDE, CENTRAL_MIDFIELD, CENTRAL_MIDFIELD, CENTRAL_MIDFIELD, WIDE, WIDE],
  Array.from({ length: 5 }, () => ATTACKING_MIDFIELD),
  Array.from({ length: 6 }, () => FORWARD),
].flat();

/** A value per position code 0..31, computed once per distinct weight row (codes sharing one rate alike). */
export const byPositionCode = (value: (code: number) => number): readonly number[] => {
  const known = new Map<WeightRow, number>();
  return OVR_WEIGHTS.map((row, code) => {
    const cached = known.get(row) ?? value(code);
    known.set(row, cached);
    return cached;
  });
};

/** fifa.db `curves`: per curve id, the values for ages 15..45 (columns a..ee). */
export type Curves = ReadonlyMap<number, readonly number[]>;

/** The `curves` columns for ages 15..45. */
export const CURVE_COLUMNS =
  "a b c d e f g h i j k l m n o p q r s t u v w x y z aa bb cc dd ee".split(" ");
const CURVE_AGE_MIN = 15;
const CURVE_AGE_MAX = 44;
/** The career's calendar base date (EBOOT 0x088EA2E8): reference ages are taken on it every season. */
const CAREER_REFERENCE_DATE = new Date("2009-01-01");
/** These attributes follow the physical curve of the development type. */
const PHYSICAL = new Set<AttributeName>([
  "acceleration",
  "sprintspeed",
  "reflexes",
  "stamina",
  "strength",
]);
const DAY_MS = 86_400_000;
const DAYS_PER_YEAR = 365.25;
const RATING_MAX = 99;
const AGED_ATTRIBUTE_MIN = 10;

export const readCurves = (db: EaDb): Curves =>
  new Map(
    readTable(db, "curves").map((row) => [
      Number(row["id"]),
      CURVE_COLUMNS.map((column) => Number(row[column])),
    ]),
  );

/** The career potential: potential plus the save's potential_delta, per player id. */
export const potentialDeltas = (db: EaDb, save: CareerSave): ReadonlyMap<number, number> =>
  new Map(
    effectiveRows(db, save, "career_players_grown_attributes").map((row) => [
      Number(row["playerid"]),
      Number(row["potential_delta"]),
    ]),
  );

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** x + 0.5 truncated, in float32 like the game's single-precision FPU. */
const roundHalfUp = (value: number): number => Math.trunc(Math.fround(value + 0.5));

const weightRow = (positionCode: number): WeightRow => {
  const row = OVR_WEIGHTS[positionCode];
  if (row === undefined)
    throw new RangeError(`No OVR weights for position ${String(positionCode)}`);
  return row;
};

const ratingOf = (row: WeightRow, value: (name: AttributeName) => number): number =>
  roundHalfUp(
    row.reduce(
      (sum, [name, weight]) => Math.fround(sum + Math.fround(value(name) * Math.fround(weight))),
      0,
    ),
  );

/** OVR at a position from the database attributes, as outside career mode. */
export const baseOverall = (attributes: Attributes, positionCode: number): number =>
  clamp(
    ratingOf(weightRow(positionCode), (name) => attributes[name]),
    0,
    RATING_MAX,
  );

export interface CareerRatingInput {
  readonly attributes: Attributes;
  /** Potential plus the save's potential_delta. */
  readonly potential: number;
  readonly birthdate: Date;
  readonly developmentTypeCode: number;
  readonly developmentStyleCode: number;
}

/** Whole years as the game counts them: days / 365.25, truncated. */
const gameAge = (birthdate: Date, on: Date): number =>
  Math.trunc((on.getTime() - birthdate.getTime()) / DAY_MS / DAYS_PER_YEAR);

/** OVR at a position on a career date: attributes aged along their curves, capped at the potential. */
export const careerOverall = (
  player: CareerRatingInput,
  positionCode: number,
  careerDate: Date,
  curves: Curves,
): number => {
  const { attributes, potential, developmentTypeCode: type, developmentStyleCode: style } = player;
  const curveAt = (id: number, age: number): number => {
    const values = curves.get(id) ?? curves.get(1) ?? [];
    return values[clamp(age, CURVE_AGE_MIN, CURVE_AGE_MAX) - CURVE_AGE_MIN] ?? 0;
  };
  const ageNow = gameAge(player.birthdate, careerDate);
  const ageRef = gameAge(player.birthdate, CAREER_REFERENCE_DATE);
  const aged = (name: AttributeName): number => {
    const value = attributes[name];
    const curve = PHYSICAL.has(name) ? type + 14 : 3 * style + type - 4;
    const ratio = Math.fround(Math.fround(value / curveAt(curve, ageRef)) * 100);
    const adjusted = roundHalfUp(Math.fround(Math.fround(curveAt(curve, ageNow) * ratio) / 100));
    return Math.min(clamp(adjusted, AGED_ATTRIBUTE_MIN, RATING_MAX), Math.max(potential, value));
  };
  return clamp(Math.min(ratingOf(weightRow(positionCode), aged), potential), 0, RATING_MAX);
};
