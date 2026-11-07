import { describe, expect, it, vi } from "vitest";
import { SCOUT_CONFIG } from "./config.ts";
import {
  createScoutStore,
  openScoutStore,
  memoryBackend,
  notesFromWatchlist,
  SCHEMA_VERSION,
} from "./scout-store.ts";

const stored = {
  playerId: 7,
  text: "left foot",
  name: "Paweł Brożek",
  changedAt: "2026-11-05T10:00:00.000Z",
};

const failingSet = async () => Promise.reject(new Error("quota"));

const loadWith = async (records: Readonly<Record<string, unknown>>) => {
  const backend = memoryBackend();
  await Promise.all(Object.entries(records).map(async ([key, value]) => backend.set(key, value)));
  return { backend, loaded: await createScoutStore(backend).load() };
};

const loadNotes = async (...value: unknown[]) =>
  (await loadWith({ notes: { schemaVersion: SCHEMA_VERSION.notes, value } })).loaded.notes;

/** A version 1 watchlist: each entry held the player's note. */
const v1List = {
  schemaVersion: 1,
  value: [
    { playerId: 7, note: "left foot", addedAt: "2026-11-05T10:00:00.000Z" },
    { playerId: 3, note: "  ", addedAt: "2026-11-04T10:00:00.000Z" },
    { playerId: 5, note: "", addedAt: "2026-11-03T10:00:00.000Z" },
  ],
};

describe("stored notes", () => {
  it("are empty when nothing is stored", async () => {
    expect(await createScoutStore(memoryBackend()).load()).toMatchObject({ notes: [] });
  });

  it("save and load in their order", async () => {
    const backend = memoryBackend();
    const store = createScoutStore(backend);
    const notes = [stored, { ...stored, playerId: 3, name: null }];
    await store.saveNotes(notes);
    expect(await backend.get("notes")).toEqual({ schemaVersion: 1, value: notes });
    expect((await store.load()).notes).toEqual(notes);
  });

  it("cut a note over the technical limit rather than losing it", async () => {
    const [note] = await loadNotes({ ...stored, text: "x".repeat(SCOUT_CONFIG.noteMaxChars + 1) });
    expect(note?.text).toHaveLength(SCOUT_CONFIG.noteMaxChars);
  });

  it.each([
    ["no player id", { ...stored, playerId: undefined }],
    ["a fractional player id", { ...stored, playerId: 1.5 }],
    ["a text that is not text", { ...stored, text: 3 }],
    ["an empty text", { ...stored, text: " " }],
    ["a name that is not text", { ...stored, name: 3 }],
    ["a date that is not a date", { ...stored, changedAt: "yesterday" }],
    ["not a record", "7"],
  ])("drop a note with %s and keep the others", async (_name, bad) => {
    expect(await loadNotes(bad, { ...stored, playerId: 8 })).toEqual([{ ...stored, playerId: 8 }]);
  });

  it("keep the first of two notes for one player", async () => {
    expect(await loadNotes(stored, { ...stored, text: "other" })).toEqual([stored]);
  });
});

describe("notes moved out of a version 1 watchlist", () => {
  it("takes each entry's note with its date as the change, and no name", () => {
    expect(notesFromWatchlist(v1List.value)).toEqual([
      { playerId: 7, text: "left foot", name: null, changedAt: "2026-11-05T10:00:00.000Z" },
    ]);
  });

  it("loads the list without notes and the notes apart, and stores the notes at once", async () => {
    const { backend, loaded } = await loadWith({ watchlist: v1List });
    expect(loaded.watchlist).toEqual(
      v1List.value.map(({ playerId, addedAt }) => ({ playerId, addedAt })),
    );
    expect(loaded.notes).toEqual(notesFromWatchlist(v1List.value));
    // Stored before the list is saved again without them, so no note is lost.
    expect(await backend.get("notes")).toEqual({
      schemaVersion: SCHEMA_VERSION.notes,
      value: notesFromWatchlist(v1List.value),
    });
  });

  it("does not move them again once a notes record exists, even one it cannot read", async () => {
    const notes = { schemaVersion: SCHEMA_VERSION.notes, value: [] };
    expect((await loadWith({ watchlist: v1List, notes })).loaded.notes).toEqual([]);
    const foreign = { schemaVersion: 99, value: [stored] };
    const { backend, loaded } = await loadWith({ watchlist: v1List, notes: foreign });
    expect(loaded.notes).toEqual([]);
    expect(await backend.get("notes")).toEqual(foreign);
  });

  it("still returns the moved notes when storing them fails, and reports it", async () => {
    const backend = memoryBackend();
    await backend.set("watchlist", v1List);
    await backend.set("gameDb", {
      schemaVersion: SCHEMA_VERSION.gameDb,
      value: { bytes: Uint8Array.of(1), name: "fifa.db" },
    });
    const set = async (key: string, value: unknown) =>
      key === "notes" ? Promise.reject(new Error("quota")) : backend.set(key, value);
    const onFailed = vi.fn<() => void>();
    const { stored: opened } = await openScoutStore({ get: backend.get, set }, onFailed);
    expect(onFailed).toHaveBeenCalledOnce();
    expect(opened.gameName).toBe("fifa.db");
    expect(opened.watchlist).toHaveLength(3);
    expect(opened.notes).toEqual(notesFromWatchlist(v1List.value));
    // The list keeps its notes on disk, so the next load moves them again.
    expect(await backend.get("watchlist")).toEqual(v1List);
    expect(await backend.get("notes")).toBeUndefined();
  });

  it("loads the moved notes when storing them fails and nobody listens", async () => {
    const backend = memoryBackend();
    await backend.set("watchlist", v1List);
    const loaded = await createScoutStore({ get: backend.get, set: failingSet }).load();
    expect(loaded.notes).toEqual(notesFromWatchlist(v1List.value));
  });
});
