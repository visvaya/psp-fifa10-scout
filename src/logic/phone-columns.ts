// The number columns of the phone rows: OVR and the potential first, then what the position rating (its
// peak only when ranged or sorted by), the range filters and the sort by a number or a yes / no field add.
// The rows scroll sideways when they do not fit.
import { isFlagKey, isRangeKey, rangedKeys } from "./filter-players.ts";
import type { PlayerFilters } from "./filter-players.ts";
import { POTENTIAL_KEYS } from "./sort-players.ts";
import type { SortKey } from "./sort-players.ts";

export const phoneColumns = (options: {
  readonly showPotential: boolean;
  /** The position rating filter's code; null without that filter. */
  readonly ratingCode: number | null;
  /** That filter ranges the peak at its position. */
  readonly ratingPeakSet: boolean;
  readonly ranges: PlayerFilters["ranges"];
  readonly sortKey: SortKey;
}): readonly SortKey[] => {
  const { showPotential, ratingCode, ratingPeakSet, ranges, sortKey } = options;
  const peakShown = ratingCode !== null && (ratingPeakSet || sortKey === "positionPeak");
  const columns: readonly SortKey[] = [
    "overall",
    ...(showPotential ? (["potential"] as const) : []),
    ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
    ...(peakShown ? (["positionPeak"] as const) : []),
    ...rangedKeys(ranges),
    ...(isRangeKey(sortKey) || isFlagKey(sortKey) ? [sortKey] : []),
  ];
  return [...new Set(columns)].filter((key) => showPotential || !POTENTIAL_KEYS.has(key));
};
