// The columns both layouts show, from one place: what the filters and the sort choose on their own (the
// table's here, the phone rows' in phone-columns.ts), less what the user hid and plus what they showed.
import type { ColumnPreference } from "./column-preference.ts";
import { CAREER_RANGE_KEYS } from "./filter-players.ts";
import type { AttributeName } from "./players.ts";
import { inRecordOrder } from "./scout-state.ts";
import { POTENTIAL_KEYS, RATING_SORT_KEYS, SORTABLE_KEYS } from "./sort-players.ts";
import type { SortKey } from "./sort-players.ts";

// The ratings follow the position, before the wide text columns, so they show without scrolling sideways.
const LEAD_COLUMNS: readonly SortKey[] = ["name", "age", "positionCode"];
const DETAIL_COLUMNS: readonly SortKey[] = [
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
  "price",
];
const TABLE_ATTRIBUTES: readonly AttributeName[] = [
  "sprintspeed",
  "dribbling",
  "shortpassing",
  "finishing",
  "tackling",
  "reactions",
];

/** The values only a career has, which an override cannot show without one. */
const CAREER_KEYS: ReadonlySet<SortKey> = new Set([...CAREER_RANGE_KEYS, "positionPeak"]);

/** The wide table's columns before the user's choice, the name first. */
export const tableColumns = (options: {
  /** The position of the position rating filter; null without that filter. */
  readonly ratingCode: number | null;
  readonly showPotential: boolean;
  /** Attributes with a range filter, in the order they were added. */
  readonly ranged: readonly AttributeName[];
  /** Some player has a price (a career save). */
  readonly priced: boolean;
  /** Some player has a peak OVR (a career save). */
  readonly projected: boolean;
}): readonly SortKey[] => {
  const { ratingCode, showPotential, ranged, priced, projected } = options;
  return [
    ...LEAD_COLUMNS,
    "overall",
    ...(ratingCode === null ? [] : (["positionRating", "ratingGain"] as const)),
    ...(ratingCode !== null && showPotential && projected ? (["positionPeak"] as const) : []),
    ...(showPotential ? (["potential", ...(projected ? (["peak"] as const) : [])] as const) : []),
    ...ranged,
    ...DETAIL_COLUMNS.filter((column) => priced || column !== "price"),
    ...TABLE_ATTRIBUTES.filter((name) => !ranged.includes(name)),
  ];
};

/**
 * The automatic columns less the hidden ones, then the shown ones they lack in the order they were turned
 * on. The name stays; the potential's values, the position rating's and a career's show only where they
 * have something to show.
 */
export const effectiveColumns = (
  automatic: readonly SortKey[],
  overrides: ColumnPreference | undefined,
  context: {
    readonly showPotential: boolean;
    /** The position of the position rating filter; null without that filter. */
    readonly ratingCode: number | null;
    readonly career: boolean;
  },
): readonly SortKey[] => {
  const chosen = overrides ?? {};
  const shown = inRecordOrder(SORTABLE_KEYS, chosen).filter(
    (key) => chosen[key] === "shown" && key !== "name" && !automatic.includes(key),
  );
  return [
    ...automatic.filter((key) => key === "name" || chosen[key] !== "hidden"),
    ...shown,
  ].filter(
    (key) =>
      (context.showPotential || !POTENTIAL_KEYS.has(key)) &&
      (context.ratingCode !== null || !RATING_SORT_KEYS.has(key)) &&
      (context.career || !CAREER_KEYS.has(key)),
  );
};
