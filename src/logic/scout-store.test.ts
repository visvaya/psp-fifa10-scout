import { describe, expect, it } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

describe("scout store", () => {
  it("loads nothing from an empty backend", async () => {
    const store = createScoutStore(memoryBackend());
    expect(await store.load()).toEqual({ gameDb: null, preferences: null });
  });

  it("saves and loads the game database and the preferences", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences = {
      filters: { text: "mes", age: { min: 18, max: 23 } },
      sort: { key: "age", direction: "ascending" },
    } as const;
    await store.saveGameDb(Uint8Array.of(1, 2, 3));
    await store.savePreferences(preferences);
    expect(await store.load()).toEqual({ gameDb: Uint8Array.of(1, 2, 3), preferences });
  });

  it("ignores records of another schema version or shape", async () => {
    const backend = memoryBackend();
    await backend.set("gameDb", { schemaVersion: SCHEMA_VERSION + 1, value: Uint8Array.of(1) });
    await backend.set("preferences", { schemaVersion: SCHEMA_VERSION, value: { filters: 3 } });
    expect(await createScoutStore(backend).load()).toEqual({ gameDb: null, preferences: null });
    await backend.set("gameDb", "junk");
    await backend.set("preferences", {
      schemaVersion: SCHEMA_VERSION,
      value: { filters: {}, sort: { key: "salary", direction: "ascending" } },
    });
    expect(await createScoutStore(backend).load()).toEqual({ gameDb: null, preferences: null });
  });

  it("accepts the default sort with empty filters", async () => {
    const backend = memoryBackend();
    const preferences = { filters: {}, sort: DEFAULT_SORT };
    await createScoutStore(backend).savePreferences(preferences);
    expect((await createScoutStore(backend).load()).preferences).toEqual(preferences);
  });
});
