// The steps that bring stored preferences of versions 2 to 5 to the current shape (scout-store.ts parses
// the result).
import type { ListMembership } from "./filter-players.ts";
import { isFiniteNumber, isRecord, recordOf } from "./stored-record.ts";

/** Version 2 filters (one field per filter, attribute minimums) in the version 3 shape. */
const migrateFromV2 = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const filters = recordOf(value["filters"]);
  const minimums = Object.entries(recordOf(filters["attributeMin"])).map(
    ([name, min]) => [name, { min }] as const,
  );
  const { contractEndsBy } = filters;
  return {
    ...value,
    filters: {
      ...filters,
      ranges: {
        ...Object.fromEntries(minimums),
        age: filters["age"],
        potential: filters["potential"],
        overall: filters["overall"],
        contractEndYear: contractEndsBy === undefined ? undefined : { max: contractEndsBy },
      },
      lists: {
        positionGroup: filters["positionGroups"],
        leagueId: filters["leagueIds"],
        clubId: filters["teamIds"],
        nationalityId: filters["nationalityIds"],
      },
    },
  };
};

/** Version 3 position groups: "wide" held side midfielders and wingers, "full-backs" the sweeper. */
const V3_GROUPS: Readonly<Record<string, readonly string[]>> = {
  wide: ["side-midfield", "wingers"],
  "full-backs": ["full-backs", "sweeper"],
};

/** Version 3 filters with the version 4 position groups. */
const migrateFromV3 = (value: unknown): unknown => {
  const filters = recordOf(recordOf(value)["filters"]);
  const lists = recordOf(filters["lists"]);
  const groups = lists["positionGroup"];
  if (!isRecord(value) || !Array.isArray(groups)) return value;
  const positionGroup = groups.flatMap((group: unknown): readonly unknown[] =>
    typeof group === "string" ? (V3_GROUPS[group] ?? [group]) : [group],
  );
  return { ...value, filters: { ...filters, lists: { ...lists, positionGroup } } };
};

/** A bound in tenths as the value itself; anything else is left for the parser to drop. */
const tenths = (bound: unknown): unknown =>
  isFiniteNumber(bound) ? Math.round(bound) / 10 : bound;

/** Version 4 kept the average match rating range in the save's tenths (65 for 6,5). */
const migrateFromV4 = (value: unknown): unknown => {
  const filters = recordOf(recordOf(value)["filters"]);
  const ranges = recordOf(filters["ranges"]);
  if (!isRecord(value) || !isRecord(ranges["form"])) return value;
  const { min, max } = ranges["form"];
  const form = { min: tenths(min), max: tenths(max) };
  return { ...value, filters: { ...filters, ranges: { ...ranges, form } } };
};

/**
 * The list choice for version 5's two list flags: the one that keeps the same players, or the closest.
 * One flag set and the other cleared, or one cleared alone, has no option of its own; it differs from
 * the closest by the few players the other list holds.
 */
const listChoice = (flags: Readonly<Record<string, unknown>>): ListMembership | undefined => {
  const [tool, game] = [flags["onMyList"], flags["shortlisted"]];
  if (tool === true) return game === true ? "both" : "tool";
  if (game === true) return "game";
  return tool === false || game === false ? "none" : undefined;
};

/** Filters with version 5's list flags as the list choice. */
const listFlagsMoved = (filters: unknown): unknown => {
  if (!isRecord(filters)) return filters;
  const old = recordOf(filters["flags"]);
  const { onMyList: _tool, shortlisted: _game, ...flags } = old;
  const onList = listChoice(old);
  return {
    ...filters,
    ...(filters["flags"] === undefined ? {} : { flags }),
    ...(onList === undefined ? {} : { onList }),
  };
};

const setFlagsMoved = (set: unknown): unknown =>
  isRecord(set) ? { ...set, filters: listFlagsMoved(set["filters"]) } : set;

/** Version 5 filters, and those of the saved sets, with the list choice for the two list flags. */
const migrateFromV5 = (value: unknown): unknown => {
  if (!isRecord(value)) return value;
  const sets = value["filterSets"];
  return {
    ...value,
    filters: listFlagsMoved(value["filters"]),
    ...(Array.isArray(sets) ? { filterSets: sets.map(setFlagsMoved) } : {}),
  };
};

/** The steps from each earlier version on: version n starts at index n - 2. */
export const PREFERENCE_MIGRATIONS = [migrateFromV2, migrateFromV3, migrateFromV4, migrateFromV5];
