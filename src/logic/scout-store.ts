// The one load/save adapter: the extracted fifa.db, the career save, the filter and sort preferences and the
// own watchlist, each stored as { schemaVersion, value } in a key-value backend (IndexedDB in the browser, memory otherwise).
// Nothing leaves the device. Preferences 2, 3 and 4 migrate to 5, a fifa.db 1 (bare bytes) to 2 (bytes and
// the game file's name) and languages 1 and 2 to 3 (empty for the position names they lack); any other
// version or shape is ignored, and
// unknown or malformed filter values and column overrides are dropped one by one (a record without the
// columns loads as none, so they needed no new version).
import type { GameLanguages, GameNames } from "./game-names.ts";
import { bounded, FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "./filter-players.ts";
import type { ListKey, PositionRating, Range } from "./filter-players.ts";
import type { SaveFiles } from "./load-scout.ts";
import { OVR_WEIGHTS } from "./overall-rating.ts";
import { POSITION_GROUPS, ratingCodeOf } from "./positions.ts";
import { compactFilters, DEFAULT_SORT, inRecordOrder } from "./scout-state.ts";
import type { ClubStatus, MyClub, Preferences, ScoutFilters, ScoutSort } from "./scout-state.ts";
import type { ColumnPreference } from "./column-preference.ts";
import type { FilterSet } from "./saved-filters.ts";
import { SORTABLE_KEYS } from "./sort-players.ts";
import { clippedNote } from "./watchlist.ts";
import type { WatchEntry } from "./watchlist.ts";

/**
 * Per record, so a change to the preferences keeps the stored fifa.db. Preferences 2: clubStatus;
 * 3: ranges, lists and flags, showPotential; 4: sweeper, side midfield and wingers as groups. Game
 * database 2: the game file's name. Languages 2: position abbreviations; 3: full position names.
 */
export const SCHEMA_VERSION = {
  gameDb: 2,
  preferences: 5,
  languages: 3,
  careerSave: 1,
  watchlist: 1,
} as const;

export interface StorageBackend {
  readonly get: (key: string) => Promise<unknown>;
  readonly set: (key: string, value: unknown) => Promise<void>;
}

export interface StoredScout {
  readonly gameDb: Uint8Array | null;
  /** The name of the file the fifa.db came from, null when stored without one. */
  readonly gameName: string | null;
  readonly preferences: Preferences | null;
  readonly languages: GameLanguages;
  /** The last career save loaded, as picked, so the career comes back after the app restarts. */
  readonly careerSave: SaveFiles<Uint8Array> | null;
  /** The own watchlist; empty when nothing valid is stored. */
  readonly watchlist: readonly WatchEntry[];
}

export const memoryBackend = (): StorageBackend => {
  const values = new Map<string, unknown>();
  return {
    get: (key) => Promise.resolve(values.get(key)),
    set: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const versioned = (record: unknown, version: number): unknown =>
  isRecord(record) && record["schemaVersion"] === version ? record["value"] : undefined;

const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  isRecord(value) ? value : {};

const CLUB_STATUSES: readonly unknown[] = ["available", "free-agents"] satisfies ClubStatus[];
const isClubStatus = (value: unknown): value is ClubStatus => CLUB_STATUSES.includes(value);

const MY_CLUB: readonly unknown[] = ["hide", "only"] satisfies MyClub[];
const isMyClub = (value: unknown): value is MyClub => MY_CLUB.includes(value);

const isFiniteNumber = (value: unknown): value is number => Number.isFinite(value);

const parseRange = (value: unknown): Range => {
  const { min, max } = recordOf(value);
  return {
    ...(isFiniteNumber(min) ? { min } : {}),
    ...(isFiniteNumber(max) ? { max } : {}),
  };
};

/** A range of a position rating (its gain or peak), undefined when it sets no bound. */
const parseRatingRange = (value: unknown): Range | undefined => {
  const range = parseRange(value);
  return bounded(range) ? range : undefined;
};

/**
 * A position rating filter with a known position code 0..31, moved to its rating choice's code (rated
 * the same way), or undefined.
 */
const parsePositionRating = (value: unknown): PositionRating | undefined => {
  const { code, gain, peak, bestOnly } = recordOf(value);
  if (!(Number.isInteger(code) && isFiniteNumber(code) && code >= 0 && code < OVR_WEIGHTS.length))
    return undefined;
  const [gainRange, peakRange] = [parseRatingRange(gain), parseRatingRange(peak)];
  return {
    code: ratingCodeOf(code),
    ...parseRange(value),
    ...(gainRange === undefined ? {} : { gain: gainRange }),
    ...(peakRange === undefined ? {} : { peak: peakRange }),
    ...(bestOnly === true ? { bestOnly } : {}),
  };
};

/** Which stored values each list accepts: a known name or an integer code. */
const LIST_VALUES: Readonly<Partial<Record<ListKey, readonly unknown[]>>> = {
  positionGroup: POSITION_GROUPS,
  preferredFoot: ["left", "right"],
};

/** The valid entries of `keys` in a stored record, each parsed by `parse` (undefined drops it). */
const entriesOf = <K extends string, V>(
  value: unknown,
  keys: readonly K[],
  parse: (item: unknown, key: K) => V | undefined,
): Partial<Record<K, V>> => {
  const record = recordOf(value);
  const parsed: Partial<Record<K, V>> = {};
  for (const key of inRecordOrder(keys, record)) {
    const item = parse(record[key], key);
    if (item !== undefined) parsed[key] = item;
  }
  return parsed;
};

const parseFilters = (value: unknown): ScoutFilters => {
  const record = recordOf(value);
  const { text, ranges, lists, excludedLists, flags, clubStatus, myClub, excludeMyClub } = record;
  const { peakAtBest } = record;
  const rating = parsePositionRating(record["positionRating"]);
  return {
    ...(typeof text === "string" ? { text } : {}),
    ranges: entriesOf(ranges, RANGE_KEYS, parseRange),
    lists: entriesOf(lists, LIST_FIELDS, (item, key) => {
      const allowed = LIST_VALUES[key];
      return Array.isArray(item)
        ? item.filter((code) => allowed?.includes(code) ?? Number.isInteger(code))
        : undefined;
    }),
    excludedLists: entriesOf(excludedLists, LIST_FIELDS, (item) =>
      item === true ? item : undefined,
    ),
    flags: entriesOf(flags, FLAG_KEYS, (item) => (typeof item === "boolean" ? item : undefined)),
    ...(rating === undefined ? {} : { positionRating: rating }),
    ...(peakAtBest === true ? { peakAtBest } : {}),
    ...(isClubStatus(clubStatus) ? { clubStatus } : {}),
    // excludeMyClub: the checkbox "Mój klub" replaced, kept as "hide".
    ...(isMyClub(myClub) ? { myClub } : excludeMyClub === true ? { myClub: "hide" as const } : {}),
  };
};

/** The stored sort, or the default for a key the app no longer offers (the filters around it still load). */
const parseSort = (value: unknown): ScoutSort => {
  const { key, direction } = recordOf(value);
  const sortKey = SORTABLE_KEYS.find((sortable) => sortable === key);
  return sortKey === undefined || (direction !== "ascending" && direction !== "descending")
    ? DEFAULT_SORT
    : { key: sortKey, direction };
};

/** The stored named filter sets with a name; others are dropped. */
const parseFilterSets = (value: unknown): readonly FilterSet[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : []).flatMap((item: unknown): readonly FilterSet[] => {
    const { name, filters, sort } = recordOf(item);
    const trimmed = typeof name === "string" ? name.trim() : "";
    // Names are unique, as saving keeps them: of two sets with one name the first stays.
    if (trimmed === "" || seen.has(trimmed)) return [];
    seen.add(trimmed);
    return [
      { name: trimmed, filters: compactFilters(parseFilters(filters)), sort: parseSort(sort) },
    ];
  });
};

/** The stored column overrides in the order they were made; unknown keys and values are dropped. */
const parseColumns = (value: unknown): ColumnPreference =>
  entriesOf(value, SORTABLE_KEYS, (item) =>
    item === "shown" || item === "hidden" ? item : undefined,
  );

const parsePreferences = (value: unknown): Preferences | null => {
  if (!isRecord(value) || !isRecord(value["filters"])) return null;
  const filterSets = parseFilterSets(value["filterSets"]);
  const columns = parseColumns(value["columns"]);
  return {
    filters: compactFilters(parseFilters(value["filters"])),
    sort: parseSort(value["sort"]),
    ...(filterSets.length === 0 ? {} : { filterSets }),
    ...(Object.keys(columns).length === 0 ? {} : { columns }),
    showPotential: value["showPotential"] === true,
    ...(typeof value["gameLanguage"] === "string" || value["gameLanguage"] === null
      ? { gameLanguage: value["gameLanguage"] }
      : {}),
  };
};

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

const preferencesOf = (record: unknown): Preferences | null => {
  if (!isRecord(record)) return null;
  const { schemaVersion, value } = record;
  if (schemaVersion === 2)
    return parsePreferences(migrateFromV4(migrateFromV3(migrateFromV2(value))));
  if (schemaVersion === 3) return parsePreferences(migrateFromV4(migrateFromV3(value)));
  if (schemaVersion === 4) return parsePreferences(migrateFromV4(value));
  return parsePreferences(versioned(record, SCHEMA_VERSION.preferences));
};

const isNameRecord = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((name) => typeof name === "string");

const isGameNames = (value: unknown): value is GameNames =>
  isRecord(value) &&
  [
    value["teams"],
    value["leagues"],
    value["countries"],
    value["positions"],
    value["positionNames"],
  ].every(isNameRecord);

/** What the earlier versions of the stored languages lack, as empty names. */
const LANGUAGES_LACK: Readonly<Record<number, Readonly<Record<string, object>>>> = {
  1: { positions: {}, positionNames: {} },
  2: { positionNames: {} },
  [SCHEMA_VERSION.languages]: {},
};

/** The stored languages whose names have the expected shape, earlier versions completed. */
const parseLanguages = (record: unknown): GameLanguages => {
  const version = recordOf(record)["schemaVersion"];
  const lack = typeof version === "number" ? LANGUAGES_LACK[version] : undefined;
  if (lack === undefined) return {};
  return Object.fromEntries(
    Object.entries(recordOf(recordOf(record)["value"])).flatMap(([code, stored]) => {
      const names = { ...recordOf(stored), ...lack };
      return isGameNames(names) ? [[code, names] as const] : [];
    }),
  );
};

/** The stored fifa.db and its file name; version 1 stored the bytes alone. */
const gameDbOf = (record: unknown): Pick<StoredScout, "gameDb" | "gameName"> => {
  const v1 = versioned(record, 1);
  const { bytes, name } = recordOf(versioned(record, SCHEMA_VERSION.gameDb));
  const gameDb = v1 ?? bytes;
  return {
    gameDb: gameDb instanceof Uint8Array ? gameDb : null,
    gameName: v1 === undefined && typeof name === "string" ? name : null,
  };
};

const careerSaveOf = (record: unknown): SaveFiles<Uint8Array> | null => {
  const { dataBin, paramSfo } = recordOf(versioned(record, SCHEMA_VERSION.careerSave));
  return dataBin instanceof Uint8Array && paramSfo instanceof Uint8Array
    ? { dataBin, paramSfo }
    : null;
};

/** The stored own watchlist: entries of a player id, a note (cut to the limit) and a date; others are dropped. */
const watchlistOf = (record: unknown): readonly WatchEntry[] => {
  const value = versioned(record, SCHEMA_VERSION.watchlist);
  const seen = new Set<number>();
  return (Array.isArray(value) ? value : []).flatMap((item: unknown): readonly WatchEntry[] => {
    const { playerId, note, addedAt } = recordOf(item);
    if (
      // Stryker disable next-line ConditionalExpression: Number.isInteger rejects a non-number too; this narrows the type.
      typeof playerId !== "number" ||
      !Number.isInteger(playerId) ||
      typeof note !== "string" ||
      typeof addedAt !== "string" ||
      Number.isNaN(Date.parse(addedAt)) ||
      seen.has(playerId)
    )
      return [];
    seen.add(playerId);
    return [{ playerId, note: clippedNote(note), addedAt }];
  });
};

export const createScoutStore = (backend: StorageBackend) => ({
  load: async (): Promise<StoredScout> => {
    return {
      ...gameDbOf(await backend.get("gameDb")),
      preferences: preferencesOf(await backend.get("preferences")),
      languages: parseLanguages(await backend.get("languages")),
      careerSave: careerSaveOf(await backend.get("careerSave")),
      watchlist: watchlistOf(await backend.get("watchlist")),
    };
  },
  saveGameDb: async (gameDb: Uint8Array, name: string): Promise<void> =>
    backend.set("gameDb", { schemaVersion: SCHEMA_VERSION.gameDb, value: { bytes: gameDb, name } }),
  savePreferences: async (preferences: Preferences): Promise<void> =>
    backend.set("preferences", { schemaVersion: SCHEMA_VERSION.preferences, value: preferences }),
  /** null forgets the stored save. */
  saveCareerSave: async (save: SaveFiles<Uint8Array> | null): Promise<void> =>
    backend.set("careerSave", { schemaVersion: SCHEMA_VERSION.careerSave, value: save }),
  saveWatchlist: async (watchlist: readonly WatchEntry[]): Promise<void> =>
    backend.set("watchlist", { schemaVersion: SCHEMA_VERSION.watchlist, value: watchlist }),
  saveLanguages: async (languages: GameLanguages): Promise<void> =>
    backend.set("languages", { schemaVersion: SCHEMA_VERSION.languages, value: languages }),
});

export type ScoutStore = ReturnType<typeof createScoutStore>;

/**
 * The store over a backend, with what it holds. A backend that cannot be read (a broken IndexedDB)
 * gives an empty store that keeps nothing past the session, and calls onUnreadable.
 */
export const openScoutStore = async (backend: StorageBackend, onUnreadable: () => void) => {
  const store = createScoutStore(backend);
  try {
    return { store, stored: await store.load() };
  } catch {
    onUnreadable();
    const session = createScoutStore(memoryBackend());
    return { store: session, stored: await session.load() };
  }
};
