// The filters as the state keeps them: only the active ones, in the order they were added, and the
// ids of those that narrow the list (chips, the count on the button).
import { bounded, compactRating, FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "./filter-players.ts";
import type { FilterChange, FilterId, ScoutFilters } from "./scout-state.ts";

/** The known keys in the order the record holds them: the order filters were added orders the columns. */
export const inRecordOrder = <K extends PropertyKey>(keys: readonly K[], record: object): K[] => {
  const order = Object.keys(record);
  return keys.toSorted((a, b) => order.indexOf(String(a)) - order.indexOf(String(b)));
};

/** The entries of `keys` in `record` whose value passes `keep`, or undefined when none does. */
const pick = <T extends object>(
  record: T | undefined,
  keys: readonly (keyof T)[],
  keep: (value: NonNullable<T[keyof T]>) => boolean,
): Partial<T> | undefined => {
  const kept: Partial<T> = {};
  for (const key of inRecordOrder(keys, record ?? {})) {
    const item = record?.[key];
    if (item !== undefined && item !== null && keep(item)) kept[key] = item;
  }
  return Object.keys(kept).length === 0 ? undefined : kept;
};

const isNonEmpty = (values: readonly unknown[] | undefined): boolean =>
  values !== undefined && values.length > 0;
const isDefined = (value: unknown): boolean => value !== undefined;

/** Each filter that narrows the list, in a fixed order (for chips and the count on the button). */
export const activeFilters = (filters: FilterChange): readonly FilterId[] => [
  ...(filters.text === undefined || filters.text.trim() === "" ? [] : ["text" as const]),
  ...RANGE_KEYS.filter((key) => bounded(filters.ranges?.[key])).map(
    (key) => `ranges.${key}` as const,
  ),
  ...(filters.positionRating === undefined ? [] : ["positionRating" as const]),
  ...LIST_FIELDS.filter((key) => isNonEmpty(filters.lists?.[key])).map(
    (key) => `lists.${key}` as const,
  ),
  ...FLAG_KEYS.filter((key) => isDefined(filters.flags?.[key])).map(
    (key) => `flags.${key}` as const,
  ),
  // The choices as compactFilters keeps them: a club status only when it is not the default.
  ...(["onList", "clubStatus", "myClub"] as const).filter((key) =>
    isDefined(compactFilters(filters)[key]),
  ),
];

/** Only the active filters, so empty values never linger in state or storage. */
export const compactFilters = (filters: FilterChange): ScoutFilters => {
  const { text, clubStatus, onList, myClub, positionRating, peakAtBest } = filters;
  const ranges = pick(filters.ranges, RANGE_KEYS, bounded);
  const lists = pick(filters.lists, LIST_FIELDS, isNonEmpty);
  // An exclusion means nothing without its list's values.
  const excludedLists = pick(
    filters.excludedLists,
    LIST_FIELDS.filter((key) => lists?.[key] !== undefined),
    (excluded) => excluded,
  );
  const flags = pick(filters.flags, FLAG_KEYS, isDefined);
  return {
    ...(text === undefined || text.trim() === "" ? {} : { text }),
    ...(ranges === undefined ? {} : { ranges }),
    ...(positionRating === undefined ? {} : { positionRating: compactRating(positionRating) }),
    ...(peakAtBest === true ? { peakAtBest } : {}),
    ...(lists === undefined ? {} : { lists }),
    ...(excludedLists === undefined ? {} : { excludedLists }),
    ...(flags === undefined ? {} : { flags }),
    ...(onList === undefined ? {} : { onList }),
    ...(clubStatus === undefined || clubStatus === "available" ? {} : { clubStatus }),
    ...(myClub === undefined ? {} : { myClub }),
  };
};

/** The filters without one of them. */
export const withoutFilter = (filters: ScoutFilters, id: FilterId): ScoutFilters => {
  const [group, key = ""] = id.split(".");
  if (group === "ranges")
    return compactFilters({ ...filters, ranges: { ...filters.ranges, [key]: undefined } });
  if (group === "lists")
    return compactFilters({ ...filters, lists: { ...filters.lists, [key]: undefined } });
  if (group === "flags")
    return compactFilters({ ...filters, flags: { ...filters.flags, [key]: undefined } });
  return compactFilters({ ...filters, [id]: undefined });
};
