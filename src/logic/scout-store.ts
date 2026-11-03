// The one load/save adapter: the extracted fifa.db and the filter and sort preferences, each stored
// as { schemaVersion, value } in a key-value backend (IndexedDB in the browser, memory otherwise).
// Nothing leaves the device. A record of another version or shape is ignored, not migrated: old
// preferences give way to the defaults.
import { ATTRIBUTE_NAMES } from "./players.ts";
import type { Preferences } from "./scout-state.ts";
import type { SortKey } from "./sort-players.ts";

/** Per record, so a change to the preferences keeps the stored fifa.db. Preferences 2: clubStatus. */
export const SCHEMA_VERSION = { gameDb: 1, preferences: 2 } as const;

export interface StorageBackend {
  readonly get: (key: string) => Promise<unknown>;
  readonly set: (key: string, value: unknown) => Promise<void>;
}

export interface StoredScout {
  readonly gameDb: Uint8Array | null;
  readonly preferences: Preferences | null;
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

const isPreferences = (value: unknown): value is Preferences => {
  if (!isRecord(value) || !isRecord(value["filters"]) || !isRecord(value["sort"])) return false;
  const { key, direction } = value["sort"];
  return (
    SORTABLE_KEYS.some((sortable) => sortable === key) &&
    (direction === "ascending" || direction === "descending")
  );
};

export const createScoutStore = (backend: StorageBackend) => ({
  load: async (): Promise<StoredScout> => {
    const gameDb = versioned(await backend.get("gameDb"), SCHEMA_VERSION.gameDb);
    const preferences = versioned(await backend.get("preferences"), SCHEMA_VERSION.preferences);
    return {
      gameDb: gameDb instanceof Uint8Array ? gameDb : null,
      preferences: isPreferences(preferences) ? preferences : null,
    };
  },
  saveGameDb: async (gameDb: Uint8Array): Promise<void> =>
    backend.set("gameDb", { schemaVersion: SCHEMA_VERSION.gameDb, value: gameDb }),
  savePreferences: async (preferences: Preferences): Promise<void> =>
    backend.set("preferences", { schemaVersion: SCHEMA_VERSION.preferences, value: preferences }),
});

export type ScoutStore = ReturnType<typeof createScoutStore>;
