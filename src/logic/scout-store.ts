// The one load/save adapter: the extracted fifa.db, the game's graphics, the career save, the filter and sort preferences, the
// own watchlist and the notes on players, each stored as { schemaVersion, value } in a key-value backend (IndexedDB in the browser, memory otherwise).
// Nothing leaves the device. Preferences 2 to 5 migrate to 6, a fifa.db 1 (bare bytes) to 2 (bytes and
// the game file's name), languages 1 and 2 to 3 (empty for the position names they lack) and a watchlist 1's
// notes to their own record; any other
// version or shape is ignored, and
// unknown or malformed filter values and column overrides are dropped one by one (a record without the
// columns loads as none, without a chosen currency as the career's, a set without a currency with its
// amounts in the career's currency, without the order of the best peak tie rules as the default, without
// the approximate portraits switch as off, so they needed no new version).
import type { GameLanguages, GameNames } from "./game-names.ts";
import {
  bounded,
  CLUB_STATUSES,
  FLAG_KEYS,
  LIST_FIELDS,
  LIST_MEMBERSHIPS,
  RANGE_KEYS,
} from "./filter-players.ts";
import type {
  ClubStatus,
  ListKey,
  ListMembership,
  PositionRating,
  Range,
} from "./filter-players.ts";
import type { SaveFiles } from "./load-scout.ts";
import { OVR_WEIGHTS } from "./overall-rating.ts";
import { CONTRACT_YEARS } from "./player-finance.ts";
import { POSITION_GROUPS, ratingCodeOf } from "./positions.ts";
import { SQUAD_STATES } from "./roles.ts";
import { isCurrencyCode } from "../data/career-save.ts";
import type { GraphicsPack } from "../data/game-graphics.ts";
import { tieOrderOf } from "./best-peak.ts";
import { compactFilters, inRecordOrder } from "./filter-changes.ts";
import { DEFAULT_SORT } from "./scout-state.ts";
import type { MyClub, Preferences, ScoutFilters, ScoutSort } from "./scout-state.ts";
import type { ColumnPreference } from "./column-preference.ts";
import type { FilterSet } from "./saved-filters.ts";
import { SORTABLE_KEYS } from "./sort-players.ts";
import { clippedNote } from "./player-notes.ts";
import type { PlayerNote } from "./player-notes.ts";
import type { WatchEntry } from "./watchlist.ts";
import { PREFERENCE_MIGRATIONS } from "./preferences-migrations.ts";
import { isFiniteNumber, isRecord, recordOf, versioned } from "./stored-record.ts";

/**
 * Per record, so a change to the preferences keeps the stored fifa.db. Preferences 2: clubStatus;
 * 3: ranges, lists and flags, showPotential; 4: sweeper, side midfield and wingers as groups; 5: the
 * match rating itself; 6: one list choice for the two list flags, more club statuses. Game
 * database 2: the game file's name. Languages 2: position abbreviations; 3: full position names.
 * Watchlist 2: the notes moved to their own record.
 */
export const SCHEMA_VERSION = {
  gameDb: 2,
  preferences: 6,
  languages: 3,
  careerSave: 1,
  watchlist: 2,
  notes: 1,
  graphics: 1,
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
  /** The notes on players; empty when nothing valid is stored. */
  readonly notes: readonly PlayerNote[];
  /** The game's images from the last disc image that had them, null without one. */
  readonly graphics: GraphicsPack | null;
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

const isClubStatus = (value: unknown): value is ClubStatus =>
  CLUB_STATUSES.some((status) => status === value);
const isListMembership = (value: unknown): value is ListMembership =>
  LIST_MEMBERSHIPS.some((membership) => membership === value);

const MY_CLUB: readonly unknown[] = ["hide", "only"] satisfies MyClub[];
const isMyClub = (value: unknown): value is MyClub => MY_CLUB.includes(value);

const isInteger = (value: unknown): value is number => Number.isInteger(value);

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
  squadState: SQUAD_STATES,
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
  const { peakAtBest, onList } = record;
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
    ...(isListMembership(onList) ? { onList } : {}),
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
    const { name, filters, sort, currency } = recordOf(item);
    const trimmed = typeof name === "string" ? name.trim() : "";
    // Names are unique, as saving keeps them: of two sets with one name the first stays.
    if (trimmed === "" || seen.has(trimmed)) return [];
    seen.add(trimmed);
    return [
      {
        name: trimmed,
        filters: compactFilters(parseFilters(filters)),
        sort: parseSort(sort),
        ...(isCurrencyCode(currency) ? { currency } : {}),
      },
    ];
  });
};

/** The stored column overrides in the order they were made; unknown keys and values are dropped. */
const parseColumns = (value: unknown): ColumnPreference =>
  entriesOf(value, SORTABLE_KEYS, (item) =>
    item === "shown" || item === "hidden" ? item : undefined,
  );

/** A contract length the offer form offers. */
const isContractLength = (value: unknown): value is number =>
  CONTRACT_YEARS.some((years) => years === value);

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
    ...(isCurrencyCode(value["currency"]) ? { currency: value["currency"] } : {}),
    ...(Array.isArray(value["tieOrder"]) ? { tieOrder: tieOrderOf(value["tieOrder"]) } : {}),
    ...(value["afterSigning"] === true ? { afterSigning: true } : {}),
    ...(isContractLength(value["transferYears"]) ? { transferYears: value["transferYears"] } : {}),
    ...(value["approximatePortraits"] === true ? { approximatePortraits: true } : {}),
    ...(value["alwaysPortraits"] === true ? { alwaysPortraits: true } : {}),
  };
};

const preferencesOf = (record: unknown): Preferences | null => {
  if (!isRecord(record)) return null;
  const { schemaVersion, value } = record;
  if (isInteger(schemaVersion) && schemaVersion >= 2 && schemaVersion < SCHEMA_VERSION.preferences)
    return parsePreferences(
      PREFERENCE_MIGRATIONS.slice(schemaVersion - 2).reduce(
        (migrated, step) => step(migrated),
        value,
      ),
    );
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

/** The stored graphics when every index entry is a name, offset and length within the bytes. */
const graphicsOf = (record: unknown): GraphicsPack | null => {
  const { bytes, entries } = recordOf(versioned(record, SCHEMA_VERSION.graphics));
  if (!(bytes instanceof Uint8Array) || !Array.isArray(entries)) return null;
  const isEntry = (entry: unknown): entry is GraphicsPack["entries"][number] => {
    if (!Array.isArray(entry) || entry.length !== 3) return false;
    const items: readonly unknown[] = entry;
    const [name, offset, length] = items;
    return (
      typeof name === "string" &&
      isInteger(offset) &&
      isInteger(length) &&
      offset >= 0 &&
      length >= 0 &&
      offset + length <= bytes.length
    );
  };
  return entries.every(isEntry) ? { bytes, entries } : null;
};

/** A stored list's items that pass `parse`, the first one per player id; the rest are dropped. */
const perPlayer = <T extends { readonly playerId: number }>(
  value: unknown,
  parse: (item: Readonly<Record<string, unknown>>) => T | undefined,
): readonly T[] => {
  const seen = new Set<number>();
  return (Array.isArray(value) ? value : []).flatMap((item: unknown): readonly T[] => {
    const parsed = parse(recordOf(item));
    if (parsed === undefined || seen.has(parsed.playerId)) return [];
    seen.add(parsed.playerId);
    return [parsed];
  });
};

const isDate = (value: unknown): value is string =>
  typeof value === "string" && !Number.isNaN(Date.parse(value));

/** The stored own watchlist, of version 1 too (its notes are read by notesFromWatchlist). */
const watchlistOf = (record: unknown): readonly WatchEntry[] =>
  perPlayer(
    versioned(record, SCHEMA_VERSION.watchlist) ?? versioned(record, 1),
    ({ playerId, addedAt }) =>
      isInteger(playerId) && isDate(addedAt) ? { playerId, addedAt } : undefined,
  );

/** The stored notes on players with text, a name or none and a date, each cut to the limit. */
const notesOf = (value: unknown): readonly PlayerNote[] =>
  perPlayer(value, ({ playerId, text, name, changedAt }) =>
    isInteger(playerId) &&
    typeof text === "string" &&
    text.trim() !== "" &&
    (typeof name === "string" || name === null) &&
    isDate(changedAt)
      ? { playerId, text: clippedNote(text), name, changedAt }
      : undefined,
  );

/**
 * The notes a version 1 watchlist held in its entries: each non-empty one, dated by when its player was
 * added (the closest known change) and without a name, which the list did not keep.
 */
export const notesFromWatchlist = (entries: unknown): readonly PlayerNote[] =>
  notesOf(
    (Array.isArray(entries) ? entries : []).map((item: unknown) => {
      const { playerId, note, addedAt } = recordOf(item);
      return { playerId, text: note, name: null, changedAt: addedAt };
    }),
  );

/** Runs the writes it is given one after another, so a later write never lands before an earlier one. */
const writesInOrder = () => {
  let last: Promise<unknown> = Promise.resolve();
  return async <T>(write: () => Promise<T>): Promise<T> => {
    const next = last.then(write, write);
    last = next.catch(() => undefined);
    return next;
  };
};

export const createScoutStore = (backend: StorageBackend) => {
  // The list and the notes share the notes record while a version 1 list moves its notes out.
  const inOrder = writesInOrder();
  return {
    /** onMoveFailed: the moved notes could not be stored; they load all the same and move again next time. */
    load: async (onMoveFailed?: () => void): Promise<StoredScout> => {
      const watchlist = await backend.get("watchlist");
      const notesRecord = await backend.get("notes");
      // A version 1 list's notes are stored apart at once, so a later save of the list cannot lose them.
      const moved = notesRecord === undefined ? notesFromWatchlist(versioned(watchlist, 1)) : [];
      const notes = { schemaVersion: SCHEMA_VERSION.notes, value: moved };
      if (moved.length > 0) await backend.set("notes", notes).catch(() => onMoveFailed?.());
      return {
        ...gameDbOf(await backend.get("gameDb")),
        preferences: preferencesOf(await backend.get("preferences")),
        languages: parseLanguages(await backend.get("languages")),
        careerSave: careerSaveOf(await backend.get("careerSave")),
        watchlist: watchlistOf(watchlist),
        notes: notesOf(versioned(notesRecord ?? notes, SCHEMA_VERSION.notes)),
        graphics: graphicsOf(await backend.get("graphics")),
      };
    },
    saveGameDb: async (gameDb: Uint8Array, name: string): Promise<void> =>
      backend.set("gameDb", {
        schemaVersion: SCHEMA_VERSION.gameDb,
        value: { bytes: gameDb, name },
      }),
    saveGraphics: async (graphics: GraphicsPack): Promise<void> =>
      backend.set("graphics", { schemaVersion: SCHEMA_VERSION.graphics, value: graphics }),
    savePreferences: async (preferences: Preferences): Promise<void> =>
      backend.set("preferences", { schemaVersion: SCHEMA_VERSION.preferences, value: preferences }),
    /** null forgets the stored save. */
    saveCareerSave: async (save: SaveFiles<Uint8Array> | null): Promise<void> =>
      backend.set("careerSave", { schemaVersion: SCHEMA_VERSION.careerSave, value: save }),
    /**
     * Before it replaces a version 1 list whose notes are not stored yet, stores them; if that fails, the
     * save fails too, so the version 1 list stays on disk with its notes.
     */
    saveWatchlist: async (watchlist: readonly WatchEntry[]): Promise<void> =>
      inOrder(async () => {
        if ((await backend.get("notes")) === undefined) {
          const moved = notesFromWatchlist(versioned(await backend.get("watchlist"), 1));
          if (moved.length > 0) {
            await backend.set("notes", { schemaVersion: SCHEMA_VERSION.notes, value: moved });
          }
        }
        await backend.set("watchlist", {
          schemaVersion: SCHEMA_VERSION.watchlist,
          value: watchlist,
        });
      }),
    saveNotes: async (notes: readonly PlayerNote[]): Promise<void> =>
      inOrder(async () =>
        backend.set("notes", { schemaVersion: SCHEMA_VERSION.notes, value: notes }),
      ),
    saveLanguages: async (languages: GameLanguages): Promise<void> =>
      backend.set("languages", { schemaVersion: SCHEMA_VERSION.languages, value: languages }),
  };
};

export type ScoutStore = ReturnType<typeof createScoutStore>;

/**
 * The store over a backend, with what it holds. A backend that cannot be read (a broken IndexedDB)
 * gives an empty store that keeps nothing past the session, and calls onFailed, as a failed move of the
 * notes does.
 */
export const openScoutStore = async (backend: StorageBackend, onFailed: () => void) => {
  const store = createScoutStore(backend);
  try {
    return { store, stored: await store.load(onFailed) };
  } catch {
    onFailed();
    const session = createScoutStore(memoryBackend());
    return { store: session, stored: await session.load() };
  }
};
