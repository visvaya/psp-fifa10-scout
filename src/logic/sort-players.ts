// Player ordering by any scalar summary field or attribute; missing values go last either way,
// and ties fall back to the name, then the id (nameOrder), so the order is total. Every value is
// turned into its rank among the distinct values first: text in the given collation (Polish by
// default), numbers by size, the name by nameOrder.
import { peakAt, ratingGain } from "./filter-players.ts";
import { ATTRIBUTE_NAMES, isAttributeName, nameCollator, SEASON_STAT_KEYS } from "./players.ts";
import type { AttributeName, Player } from "./players.ts";

type Scalar = number | string | boolean | null;
type ScalarKey = {
  [K in keyof Player]: Player[K] extends Scalar ? K : never;
}[keyof Player];

/**
 * positionRating: the OVR at a chosen position code; ratingGain: that OVR minus the OVR; positionPeak:
 * the peak OVR there.
 */
export type SortKey = ScalarKey | AttributeName | "positionRating" | "ratingGain" | "positionPeak";
export type SortDirection = "ascending" | "descending";

/** The sort keys the screens offer; anything else in storage falls back to the default sort. */
export const SORTABLE_KEYS: readonly SortKey[] = [
  "name",
  "age",
  "positionCode",
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
  "potential",
  "overall",
  "growth",
  "peak",
  "peakGain",
  "height",
  "weight",
  "weakFoot",
  "internationalReputation",
  "learningSpeed",
  "retirementAge",
  "clubRating",
  "form",
  "morale",
  ...SEASON_STAT_KEYS,
  "injuryDays",
  "price",
  "wage",
  "positionRating",
  "ratingGain",
  "positionPeak",
  ...ATTRIBUTE_NAMES,
];

/** Values that reveal potential: they show only when the user asks for potential. */
export const POTENTIAL_KEYS: ReadonlySet<SortKey> = new Set([
  "potential",
  "growth",
  "peak",
  "peakGain",
  "positionPeak",
]);

/** The sort keys that need a chosen position (the position rating filter). */
export const RATING_SORT_KEYS: ReadonlySet<SortKey> = new Set([
  "positionRating",
  "ratingGain",
  "positionPeak",
]);

/** Keys whose first click sorts ascending (text, age, position, contract); numbers start high. */
const ASCENDING_FIRST = new Set<SortKey>([
  "name",
  "age",
  "positionCode",
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
]);

/** The direction a click on a sort key gives: the sorted one turns round, another starts its own way. */
export const nextDirection = (
  current: { readonly key: SortKey; readonly direction: SortDirection },
  key: SortKey,
): SortDirection => {
  if (current.key === key) return current.direction === "ascending" ? "descending" : "ascending";
  return ASCENDING_FIRST.has(key) ? "ascending" : "descending";
};

const valueOf = (player: Player, key: SortKey, ratingCode: number | undefined): Scalar => {
  if (key === "name") return player.nameOrder;
  if (key === "positionRating")
    return player.overallByCode[ratingCode ?? player.positionCode] ?? null;
  if (key === "ratingGain") return ratingCode === undefined ? null : ratingGain(player, ratingCode);
  if (key === "positionPeak") return ratingCode === undefined ? null : peakAt(player, ratingCode);
  return isAttributeName(key) ? player.attributes[key] : player[key];
};

/** Each value replaced by its rank among the distinct values (null stays null), so it stays below the count. */
const rankedValues = (
  values: readonly Scalar[],
  collator: Intl.Collator,
): readonly (number | null)[] => {
  // One key gives values of one type: text compares in the collation, numbers and booleans by size.
  const compare = (a: Scalar, b: Scalar) =>
    typeof a === "string" && typeof b === "string" ? collator.compare(a, b) : Number(a) - Number(b);
  const distinct = [...new Set(values.filter((value) => value !== null))].toSorted(compare);
  const rank = new Map(distinct.map((value, index) => [value, index]));
  return values.map((value) => (value === null ? null : (rank.get(value) ?? 0)));
};

export const sortPlayers = (
  players: readonly Player[],
  key: SortKey,
  direction: SortDirection,
  {
    ratingCode,
    collator = nameCollator,
  }: {
    /** The position code of positionRating; the preferred position without one. */
    readonly ratingCode?: number | undefined;
    /** The order of text values; Polish by default. */
    readonly collator?: Intl.Collator;
  } = {},
): readonly Player[] => {
  const sign = direction === "ascending" ? 1 : -1;
  const values = rankedValues(
    players.map((player) => valueOf(player, key, ratingCode)),
    collator,
  );
  const primary = values.map((value) => (value === null ? null : sign * value));
  const present = primary.filter((value) => value !== null);
  // Missing values sort after every present one, whatever the direction.
  const [lowest, missing] = [Math.min(0, ...present), Math.max(0, ...present) + 1];
  // One integer per player, (value, nameOrder, index), sorted natively: the slow laptop needs that
  // for 13 000 players within the 30 ms budget. Ranks and name orders stay below the count, so the
  // largest key is about count cubed (2.2e12 for 13 000 players), far below 2^53 for any field.
  const count = players.length;
  const scale = Math.max(0, ...players.map((player) => player.nameOrder)) + 1;
  const keys = Float64Array.from(
    players,
    (player, index) =>
      (((primary[index] ?? missing) - lowest) * scale + player.nameOrder) * count + index,
  ).toSorted();
  return Array.from(keys).flatMap((combined) => players[combined % count] ?? []);
};
