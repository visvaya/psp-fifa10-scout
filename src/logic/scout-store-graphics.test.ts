import { describe, expect, it } from "vitest";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

const pack = {
  bytes: Uint8Array.of(1, 2, 3, 4, 5),
  entries: [
    ["tl1873", 0, 2],
    ["ls37", 2, 3],
  ],
} as const;

const loadGraphics = async (value: unknown, schemaVersion: number = SCHEMA_VERSION.graphics) => {
  const backend = memoryBackend();
  await backend.set("graphics", { schemaVersion, value });
  return (await createScoutStore(backend).load()).graphics;
};

describe("the stored game graphics", () => {
  it("saves and loads the packed images with their index", async () => {
    const store = createScoutStore(memoryBackend());
    expect((await store.load()).graphics).toBeNull();
    await store.saveGraphics(pack);
    expect((await store.load()).graphics).toEqual(pack);
  });

  it("ignores another version", async () => {
    expect(await loadGraphics(pack, SCHEMA_VERSION.graphics + 1)).toBeNull();
  });

  it.each([
    ["no bytes", { ...pack, bytes: [1, 2, 3, 4, 5] }],
    ["no index", { ...pack, entries: "tl1873" }],
    ["an entry without its name", { ...pack, entries: [[1873, 0, 2]] }],
    ["an entry of two values", { ...pack, entries: [["tl1873", 0]] }],
    ["an entry that is no list", { ...pack, entries: [{ name: "tl1873" }] }],
    ["an entry past the bytes", { ...pack, entries: [["ls37", 2, 4]] }],
    ["a negative offset", { ...pack, entries: [["ls37", -1, 1]] }],
    ["a fractional length", { ...pack, entries: [["ls37", 0, 1.5]] }],
  ])("ignores a pack with %s", async (_, value) => {
    expect(await loadGraphics(value)).toBeNull();
  });
});
