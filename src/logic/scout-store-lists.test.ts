// The list field "Na liście" and the club status "Zawodnicy" in stored preferences: version 5 kept two
// list flags, which version 6 turns into one choice.
import { describe, expect, it } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import type { Preferences } from "./scout-state.ts";
import { createScoutStore, memoryBackend } from "./scout-store.ts";

const loadPreferences = async (record: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", record);
  return (await createScoutStore(backend).load()).preferences;
};

/** The list choice that version 5 filters with these flags load as, in the filters and in a set. */
const migrated = async (flags: Readonly<Record<string, unknown>>) => {
  const filters = { flags: { ...flags, leadership: true } };
  const loaded = await loadPreferences({
    schemaVersion: 5,
    value: {
      filters,
      sort: DEFAULT_SORT,
      filterSets: [{ name: "a", filters, sort: DEFAULT_SORT }],
    },
  });
  const [set] = loaded?.filterSets ?? [];
  expect(set?.filters).toEqual(loaded?.filters);
  expect(loaded?.filters.flags).toEqual({ leadership: true });
  return loaded?.filters.onList;
};

describe("stored list field and club status", () => {
  it("move both list flags of version 5 to the one choice that keeps the same players", async () => {
    expect(await migrated({ onMyList: true })).toBe("tool");
    expect(await migrated({ shortlisted: true })).toBe("game");
    expect(await migrated({ onMyList: true, shortlisted: true })).toBe("both");
    expect(await migrated({ onMyList: false, shortlisted: false })).toBe("none");
    expect(await migrated({})).toBeUndefined();
    expect(await migrated({ onMyList: "yes" })).toBeUndefined();
  });

  // No option keeps "on one list, off the other" or "off one list, the other any": the closest one
  // differs by the few players the other list holds.
  it("moves a version 5 combination without its own option to the closest choice", async () => {
    expect(await migrated({ onMyList: true, shortlisted: false })).toBe("tool");
    expect(await migrated({ shortlisted: true, onMyList: false })).toBe("game");
    expect(await migrated({ onMyList: false })).toBe("none");
    expect(await migrated({ shortlisted: false })).toBe("none");
  });

  it("drops malformed version 5 preferences and sets as before", async () => {
    expect(await loadPreferences({ schemaVersion: 5, value: "x" })).toBeNull();
    expect(await loadPreferences({ schemaVersion: 5, value: { filters: 5 } })).toBeNull();
    const set = { name: "a", filters: { flags: { onMyList: true } }, sort: DEFAULT_SORT };
    const value = { filters: {}, sort: DEFAULT_SORT, filterSets: ["x", set] };
    expect((await loadPreferences({ schemaVersion: 5, value }))?.filterSets).toEqual([
      { name: "a", filters: { onList: "tool" }, sort: DEFAULT_SORT },
    ]);
  });

  it("migrates the list flags of earlier versions too", async () => {
    const value = { filters: { flags: { shortlisted: true } }, sort: DEFAULT_SORT };
    expect((await loadPreferences({ schemaVersion: 3, value }))?.filters).toEqual({
      onList: "game",
    });
  });

  it("saves and loads each club status and list choice, dropping unknown ones", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences: Preferences = {
      filters: { clubStatus: "with-club", onList: "none" },
      sort: DEFAULT_SORT,
      showPotential: false,
    };
    await store.savePreferences(preferences);
    expect((await store.load()).preferences).toEqual(preferences);
    const unknown = { filters: { clubStatus: "all", onList: "any" }, sort: DEFAULT_SORT };
    expect((await loadPreferences({ schemaVersion: 6, value: unknown }))?.filters).toEqual({});
    const unavailable = { filters: { clubStatus: "unavailable" }, sort: DEFAULT_SORT };
    expect((await loadPreferences({ schemaVersion: 6, value: unavailable }))?.filters).toEqual({
      clubStatus: "unavailable",
    });
  });
});
