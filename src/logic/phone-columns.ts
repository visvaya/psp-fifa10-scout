// The number columns of the phone rows: OVR and the potential first, then what the position rating, the
// range filters and the sort add. The rows scroll sideways when they do not fit.
import { isRangeKey, rangedKeys } from "./filter-players.ts";
import type { PlayerFilters } from "./filter-players.ts";
import { POTENTIAL_KEYS } from "./sort-players.ts";
import type { SortKey } from "./sort-players.ts";

export const phoneColumns = (options: {
  readonly showPotential: boolean;
  /** The position rating filter's code; null without that filter. */
  readonly ratingCode: number | null;
  readonly ranges: PlayerFilters["ranges"];
  readonly sortKey: SortKey;
}): readonly SortKey[] => {
  const { showPotential, ratingCode, ranges, sortKey } = options;
  const columns: readonly SortKey[] = [
    "overall",
    ...(showPotential ? (["potential"] as const) : []),
    ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
    ...rangedKeys(ranges),
    ...(isRangeKey(sortKey) ? [sortKey] : []),
  ];
  return [...new Set(columns)].filter((key) => showPotential || !POTENTIAL_KEYS.has(key));
};
