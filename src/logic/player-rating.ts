// A player's ratings as the list shows them (players.ts): fifa.db's, or aged in a career to the season's
// first match day, after signing or at his peak in the profiles of the list (roadmap 56(c), 123).
import {
  attributeGains,
  agedBy,
  baseOverall,
  cappedOverall,
  careerAgeing,
  careerPotential,
  overallsByAge,
  peaksByPositionCode,
  peakSeasonsAhead,
  potentialDeltas,
  readCurves,
  signingDelta,
} from "./overall-rating.ts";
import type { CareerRatingInput, Curves } from "./overall-rating.ts";
import { seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { birthdateToDate, num } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { ATTRIBUTE_NAMES, attributesOf } from "./attributes.ts";
import type { Attributes } from "./attributes.ts";
/** A player's attributes as the list shows them and his OVR at any position code. */
export interface Rating {
  readonly attributes: Attributes;
  readonly potential: number;
  readonly overallAt: (positionCode: number, yearsAhead?: number) => number;
  /** The peak OVR at each position code; empty without a save, as nothing ages. */
  readonly peakByCode: readonly number[];
  /** OVR at the preferred position from his age this season to 45; empty without a save. */
  readonly overallByAge: readonly number[];
  /** His age on the career date the ratings are aged to; absent without a save. */
  readonly seasonAge?: number;
  /** The seasons the ratings look ahead: to his peak in the profile at the peak, else 0. */
  readonly yearsAhead: number;
}

/**
 * Which profile the list shows (roadmap 56(c), 123): as today, after a transfer to the user's club, at
 * the peak, or both.
 */
export interface ProfileMode {
  readonly afterSigning: boolean;
  readonly atPeak: boolean;
}

export const TODAY: ProfileMode = { afterSigning: false, atPeak: false };

/**
 * A player's potential_delta: the save's for the user's squad; outside it none, or after signing the one
 * the game gives then.
 */
const deltaOf =
  (deltas: ReadonlyMap<number, number>, afterSigning: boolean) =>
  (row: EaDbRow): number =>
    deltas.get(num(row, "playerid")) ?? (afterSigning ? signingDelta(row) : 0);

/** What ages in a career: fifa.db's attributes plus the save's gains, and his curves. */
const ageingInput = (
  row: EaDbRow,
  potential: number,
  gains: ReturnType<typeof attributeGains>,
): CareerRatingInput => {
  const gain = gains.get(num(row, "playerid"));
  return {
    // The gains count before ageing, as the database attributes they add to.
    attributes:
      gain === undefined
        ? attributesOf(row)
        : attributesOf(
            Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, num(row, name) + gain(name)])),
          ),
    potential,
    birthdate: birthdateToDate(num(row, "birthdate")),
    developmentTypeCode: num(row, "developmenttypecode"),
    developmentStyleCode: num(row, "developmentstylecode"),
  };
};

/**
 * Attributes and OVR from fifa.db without a save; with one, aged to the season's first match day, as
 * the game shows them in the career (overall-rating.md).
 */
export const rater = (
  db: EaDb,
  save: CareerSave | undefined,
  read: Curves | undefined,
  { afterSigning, atPeak }: ProfileMode,
): ((row: EaDbRow) => Rating) => {
  if (save === undefined)
    return (row) => {
      const attributes = attributesOf(row);
      return {
        attributes,
        potential: num(row, "potential"),
        overallAt: (code) => baseOverall(attributes, code),
        peakByCode: [],
        overallByAge: [],
        yearsAhead: 0,
      };
    };
  const curves = read ?? readCurves(db);
  const delta = deltaOf(potentialDeltas(db, save), afterSigning);
  const gains = attributeGains(db, save);
  const date = seasonStartDate(db, save);
  return (row) => {
    const potential = careerPotential(num(row, "potential"), delta(row));
    const today = careerAgeing(ageingInput(row, potential, gains), date, curves);
    const preferred = num(row, "preferredposition1");
    const peakYears = atPeak ? peakSeasonsAhead(today, preferred, potential) : 0;
    const ageing = agedBy(today, peakYears);
    const aged = ageing.attributesIn(0);
    const attributes = attributesOf(
      Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, aged(name)])),
    );
    const overallAt = (code: number, yearsAhead = 0): number =>
      cappedOverall(
        yearsAhead === 0 ? (name) => attributes[name] : ageing.attributesIn(yearsAhead),
        code,
        potential,
      );
    return {
      attributes,
      potential,
      overallAt,
      peakByCode: peaksByPositionCode(ageing, potential),
      overallByAge: overallsByAge(ageing, preferred, potential),
      seasonAge: ageing.age,
      yearsAhead: peakYears,
    };
  };
};
