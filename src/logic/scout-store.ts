// The one load/save adapter: the extracted fifa.db, the career save and the filter and sort preferences, each stored
// as { schemaVersion, value } in a key-value backend (IndexedDB in the browser, memory otherwise).
// Nothing leaves the device. Preferences 2 and 3 migrate to 4, a fifa.db 1 (bare bytes) to 2 (bytes and
// the game file's name) and languages 1 to 2 (no position names); any other version or shape is ignored, and
// unknown or malformed filter values are dropped one by one.
import type { GameLanguages, GameNames } from "./game-names.ts";
import { FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "./filter-players.ts";
import type { ListKey, PositionRating, Range } from "./filter-players.ts";
import type { SaveFiles } from "./load-scout.ts";
import { OVR_WEIGHTS } from "./overall-rating.ts";
import { ATTRIBUTE_NAMES } from "./players.ts";
import { POSITION_GROUPS } from "./positions.ts";
import { compactFilters, inRecordOrder } from "./scout-state.ts";
import type { ClubStatus, MyClub, Preferences, ScoutFilters } from "./scout-state.ts";
import type { SortKey } from "./sort-players.ts";

/**
 * Per record, so a change to the preferences keeps the stored fifa.db. Preferences 2: clubStatus;
 * 3: ranges, lists and flags, showPotential; 4: sweeper, side midfield and wingers as groups. Game
 * database 2: the game file's name. Languages 2: position names.
 */
export const SCHEMA_VERSION = { gameDb: 2, preferences: 4, languages: 2, careerSave: 1 } as const;

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
}

/** The sort keys the screens offer; anything else in storage is dropped. */
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
  "height",
  "weight",
  "weakFoot",
  "internationalReputation",
  "learningSpeed",
  "retirementAge",
  "clubRating",
  "form",
  "morale",
  "injuryDays",
  "positionRating",
  ...ATTRIBUTE_NAMES,
];

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

/** A position rating filter with a known position code 0..31, or undefined. */
const parsePositionRating = (value: unknown): PositionRating | undefined => {
  const { code } = recordOf(value);
  return Number.isInteger(code) && isFiniteNumber(code) && code >= 0 && code < OVR_WEIGHTS.length
    ? { code, ...parseRange(value) }
    : undefined;
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
  const { text, ranges, lists, flags, clubStatus, myClub, excludeMyClub, positionRating } =
    recordOf(value);
  const rating = parsePositionRating(positionRating);
  return {
    ...(typeof text === "string" ? { text } : {}),
    ranges: entriesOf(ranges, RANGE_KEYS, parseRange),
    lists: entriesOf(lists, LIST_FIELDS, (item, key) => {
      const allowed = LIST_VALUES[key];
      return Array.isArray(item)
        ? item.filter((code) => allowed?.includes(code) ?? Number.isInteger(code))
        : undefined;
    }),
    flags: entriesOf(flags, FLAG_KEYS, (item) => (typeof item === "boolean" ? item : undefined)),
    ...(rating === undefined ? {} : { positionRating: rating }),
    ...(isClubStatus(clubStatus) ? { clubStatus } : {}),
    // excludeMyClub: the checkbox "Mój klub" replaced, kept as "hide".
    ...(isMyClub(myClub) ? { myClub } : excludeMyClub === true ? { myClub: "hide" as const } : {}),
  };
};

const parsePreferences = (value: unknown): Preferences | null => {
  if (!isRecord(value) || !isRecord(value["filters"]) || !isRecord(value["sort"])) return null;
  const { key, direction } = value["sort"];
  const sortKey = SORTABLE_KEYS.find((sortable) => sortable === key);
  if (sortKey === undefined || (direction !== "ascending" && direction !== "descending")) {
    return null;
  }
  return {
    filters: compactFilters(parseFilters(value["filters"])),
    sort: { key: sortKey, direction },
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

const preferencesOf = (record: unknown): Preferences | null => {
  if (!isRecord(record)) return null;
  const { schemaVersion, value } = record;
  if (schemaVersion === 2) return parsePreferences(migrateFromV3(migrateFromV2(value)));
  if (schemaVersion === 3) return parsePreferences(migrateFromV3(value));
  return parsePreferences(versioned(record, SCHEMA_VERSION.preferences));
};

const isNameRecord = (value: unknown): boolean =>
  isRecord(value) && Object.values(value).every((name) => typeof name === "string");

const isGameNames = (value: unknown): value is GameNames =>
  isRecord(value) &&
  [value["teams"], value["leagues"], value["countries"], value["positions"]].every(isNameRecord);

/** The stored languages whose names have the expected shape; version 1 had no position names. */
const parseLanguages = (record: unknown): GameLanguages => {
  const v1 = versioned(record, 1);
  const value = v1 ?? versioned(record, SCHEMA_VERSION.languages);
  return Object.fromEntries(
    Object.entries(recordOf(value)).flatMap(([code, stored]) => {
      const names = v1 === undefined ? stored : { ...recordOf(stored), positions: {} };
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

export const createScoutStore = (backend: StorageBackend) => ({
  load: async (): Promise<StoredScout> => {
    return {
      ...gameDbOf(await backend.get("gameDb")),
      preferences: preferencesOf(await backend.get("preferences")),
      languages: parseLanguages(await backend.get("languages")),
      careerSave: careerSaveOf(await backend.get("careerSave")),
    };
  },
  saveGameDb: async (gameDb: Uint8Array, name: string): Promise<void> =>
    backend.set("gameDb", { schemaVersion: SCHEMA_VERSION.gameDb, value: { bytes: gameDb, name } }),
  savePreferences: async (preferences: Preferences): Promise<void> =>
    backend.set("preferences", { schemaVersion: SCHEMA_VERSION.preferences, value: preferences }),
  /** null forgets the stored save. */
  saveCareerSave: async (save: SaveFiles<Uint8Array> | null): Promise<void> =>
    backend.set("careerSave", { schemaVersion: SCHEMA_VERSION.careerSave, value: save }),
  saveLanguages: async (languages: GameLanguages): Promise<void> =>
    backend.set("languages", { schemaVersion: SCHEMA_VERSION.languages, value: languages }),
});

export type ScoutStore = ReturnType<typeof createScoutStore>;
