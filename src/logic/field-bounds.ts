// The values a range filter can take, in the units the list shows: the game's own limits, from the
// ranges its database declares for each field (fifa.db schema, lo..hi) or from its rules. A filter
// bound past them can only match nothing or everything, so the field moves it back onto the limit.
import { isAttributeName } from "./players.ts";
import type { RangeFields, RangeKey } from "./filter-players.ts";

export interface FieldBounds {
  readonly min: number;
  /** Unset where the game sets no maximum (money). */
  readonly max?: number;
  readonly step: number;
}

const whole = (min: number, max?: number): FieldBounds =>
  max === undefined ? { min, step: 1 } : { min, max, step: 1 };

/** A rating of the game's 1..99 scale: OVR, potential, a peak, an attribute, a club's rating. */
const RATING = whole(1, 99);
/** The ratings' room between two values of that scale. */
const RATING_GAP = whole(0, 98);
/** Four cup columns of a stat, each of the given maximum (cup0..cup3). */
const fourCups = (each: number): FieldBounds => whole(0, 4 * each);

const FIELD_BOUNDS: Readonly<Record<RangeFields, FieldBounds>> = {
  // The development curves run from 15 to 45; retirementage tops at 45.
  age: whole(15, 45),
  overall: RATING,
  potential: RATING,
  growth: RATING_GAP,
  peak: RATING,
  peakGain: RATING_GAP,
  height: whole(150, 215),
  weight: whole(50, 115),
  // weakfootability 0..4, shown as stars 1..5.
  weakFoot: whole(1, 5),
  internationalReputation: whole(1, 5),
  learningSpeed: whole(1, 5),
  retirementAge: whole(33, 45),
  clubRating: RATING,
  // Half stars from 0,5 to 5 (team-stars.ts).
  clubStars: { min: 0.5, max: 5, step: 0.5 },
  leaguePrestige: whole(0, 20),
  clubPrestige: whole(0, 20),
  contractEndYear: whole(2005, 2030),
  // playerstats.form / 10: a match counts 10..100, so KR stays within 1,0..10,0 (season-stats spec §4.1).
  form: { min: 1, max: 10, step: 0.1 },
  morale: whole(0, 99),
  appearances: whole(0, 255),
  goals: whole(0, 511),
  cupAppearances: fourCups(63),
  cupGoals: fourCups(255),
  assists: whole(0, 511),
  cupAssists: fourCups(255),
  cleanSheets: whole(0, 255),
  cupCleanSheets: fourCups(63),
  injuryDays: whole(0, 255),
  price: whole(0),
  wage: whole(0),
};

/** The bounds of a range field; every attribute is a rating. */
export const boundsOf = (key: RangeKey): FieldBounds =>
  isAttributeName(key) ? RATING : FIELD_BOUNDS[key];

/** A typed value moved onto the nearest bound when past it; an empty value stays empty. */
export const boundedValue = (bounds: FieldBounds, value: number | undefined): number | undefined =>
  value === undefined ? undefined : Math.min(Math.max(value, bounds.min), bounds.max ?? Infinity);
