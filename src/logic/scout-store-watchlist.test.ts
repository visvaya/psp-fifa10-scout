import { describe, expect, it } from "vitest";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

const stored = { playerId: 7, addedAt: "2026-11-05T10:00:00.000Z" };

const loadWatchlist = async (record: unknown) => {
  const backend = memoryBackend();
  await backend.set("watchlist", record);
  return (await createScoutStore(backend).load()).watchlist;
};

const loadEntries = async (...value: unknown[]) =>
  loadWatchlist({ schemaVersion: SCHEMA_VERSION.watchlist, value });

describe("stored watchlist", () => {
  it("is empty when nothing is stored", async () => {
    expect(await createScoutStore(memoryBackend()).load()).toMatchObject({ watchlist: [] });
  });

  it("saves and loads the list in its order", async () => {
    const backend = memoryBackend();
    const store = createScoutStore(backend);
    const list = [stored, { ...stored, playerId: 3 }];
    await store.saveWatchlist(list);
    expect(await backend.get("watchlist")).toEqual({ schemaVersion: 2, value: list });
    expect((await store.load()).watchlist).toEqual(list);
  });

  it("ignores a record of another version or shape", async () => {
    expect(await loadWatchlist({ schemaVersion: 3, value: [stored] })).toEqual([]);
    expect(await loadWatchlist({ value: [stored] })).toEqual([]);
    expect(await loadWatchlist("list")).toEqual([]);
    expect(await loadWatchlist({ schemaVersion: 2, value: { playerId: 7 } })).toEqual([]);
  });

  it.each([
    ["no player id", { ...stored, playerId: undefined }],
    ["a fractional player id", { ...stored, playerId: 1.5 }],
    ["a text player id", { ...stored, playerId: "7" }],
    ["a date that is not text", { ...stored, addedAt: 2026 }],
    ["a date that is not a date", { ...stored, addedAt: "yesterday" }],
    ["not a record", "7"],
    ["null", null],
  ])("drops an entry with %s and keeps the others", async (_name, bad) => {
    expect(await loadEntries(bad, stored)).toEqual([stored]);
  });

  it("keeps the first of two entries for one player", async () => {
    expect(await loadEntries(stored, { ...stored, addedAt: "2026-11-06T10:00:00.000Z" })).toEqual([
      stored,
    ]);
  });
});
