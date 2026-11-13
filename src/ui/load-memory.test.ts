import { describe, expect, it } from "vitest";
import type { WorkerMessage } from "../logic/load-scout.ts";
import { EMPTY_LOAD_RESULT } from "../logic/test-support/player-fixtures.ts";
import { createGameMemory, createSaveMemory } from "./load-memory.ts";
import type { MemoryStore } from "./load-memory.ts";

/** A store that records the career saves and fifa.db names written to it. */
const recordingStore = () => {
  const writes: unknown[] = [];
  const store: MemoryStore = {
    saveCareerSave: (save) => {
      writes.push(save === null ? null : [...save.dataBin]);
      return Promise.resolve();
    },
    saveGameDb: (_gameDb, name) => {
      writes.push(name);
      return Promise.resolve();
    },
    saveGraphics: (graphics) => {
      writes.push([...graphics.bytes]);
      return Promise.resolve();
    },
  };
  const withStore = (run: (opened: MemoryStore) => Promise<void>) => {
    void run(store);
  };
  return { writes, withStore, settled: async () => new Promise((resolve) => setTimeout(resolve)) };
};

const done = (requestId: number): WorkerMessage => ({
  type: "done",
  requestId,
  result: EMPTY_LOAD_RESULT,
});
/** A load's graphics message: one byte of graphics, or none. */
const graphics = (requestId: number, byte: number | null): WorkerMessage => ({
  type: "graphics",
  requestId,
  graphics: byte === null ? null : { bytes: Uint8Array.of(byte), entries: [] },
});
const save = (byte: number) => ({ dataBin: new Blob([Uint8Array.of(byte)]), paramSfo: new Blob() });

describe("createSaveMemory", () => {
  it("stores a picked save once the latest load succeeds, even after a newer load took over", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.picked(save(1));
    memory.started(1);
    memory.started(2);
    memory.finished(done(1));
    await settled();
    expect(writes).toEqual([]);
    memory.finished(done(2));
    await settled();
    expect(writes).toEqual([[1]]);
  });

  it("does not bring back a forgotten save when its load finishes later", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.picked(save(1));
    memory.started(1);
    memory.forget();
    memory.started(2);
    memory.finished(done(1));
    memory.finished(done(2));
    await settled();
    expect(writes).toEqual([null]);
  });

  it("does not write a save whose bytes were still being read when it was forgotten", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.picked(save(1));
    memory.started(1);
    memory.finished(done(1));
    memory.forget();
    await settled();
    expect(writes).toEqual([null]);
  });

  it("keeps a picked save for the next load when the game, not the save, fails", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.picked(save(1));
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "game", kind: "wrong-file" } });
    memory.started(2);
    memory.finished(done(2));
    await settled();
    expect(writes).toEqual([[1]]);
  });

  it("forgets the stored save when the latest load fails on the save", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "not-career" } });
    await settled();
    expect(writes).toEqual([null]);
  });

  it("keeps the stored save when a newly picked save fails, and offers it for the next load", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    const stored = save(1);
    memory.restored(stored);
    memory.picked(save(2));
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "damaged" } });
    await settled();
    expect(writes).toEqual([]);
    expect(memory.kept().save).toBe(stored);
  });

  it("does not erase the store when a newly picked save fails", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.picked(save(2));
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "damaged" } });
    await settled();
    expect(writes).toEqual([]);
  });

  it("offers no save once the stored save itself fails", () => {
    const { withStore } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.restored(save(1));
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "damaged" } });
    expect(memory.kept()).toEqual({});
  });

  it("offers the save of the latest successful load, and none once it is forgotten", () => {
    const { withStore } = recordingStore();
    const memory = createSaveMemory(withStore);
    const picked = save(1);
    memory.picked(picked);
    memory.started(1);
    memory.finished(done(1));
    expect(memory.kept().save).toBe(picked);
    memory.forget();
    expect(memory.kept()).toEqual({});
  });
});

describe("createGameMemory", () => {
  it("keeps a load that failed on the save as the game to reload", () => {
    const { withStore } = recordingStore();
    const memory = createGameMemory(withStore);
    const source = new Blob(["a"]);
    memory.started(1, { source, started: { gameName: "a.iso" } });
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "damaged" } });
    expect(memory.reload()).toEqual({ source, started: { gameName: "a.iso" } });
  });

  it("does not reload a game that failed itself", () => {
    const { withStore } = recordingStore();
    const memory = createGameMemory(withStore);
    memory.started(1, { source: new Blob(["a"]), started: {} });
    memory.finished({ type: "failed", requestId: 1, error: { stage: "game", kind: "wrong-file" } });
    expect(memory.reload()).toBeNull();
  });

  it("ignores a superseded load: it neither becomes the game to reload nor goes to the store", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createGameMemory(withStore);
    const [a, b] = [new Blob(["a"]), new Blob(["b"])];
    memory.started(1, { source: a, started: { gameName: "a.iso" } });
    memory.started(2, { source: b, started: { gameName: "b.iso" } });
    expect(memory.reload()?.source).toBe(b);
    memory.finished(done(2));
    memory.finished(done(1));
    await settled();
    expect(writes).toEqual(["b.iso"]);
    const reloaded = memory.reload();
    expect(reloaded?.started).toEqual({});
    expect(await reloaded?.source.arrayBuffer()).toEqual(Uint8Array.of(9).buffer);
  });

  it("stores the latest load's graphics, not a superseded load's, and keeps them for a load without", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createGameMemory(withStore);
    memory.started(1, { source: new Blob(["a"]), started: { gameName: "a.iso" } });
    memory.started(2, { source: new Blob(["b"]), started: { gameName: "b.iso" } });
    memory.finished(graphics(1, 1));
    memory.finished(graphics(2, 2));
    memory.started(3, { source: new Blob(["c"]), started: { gameName: "fifa.db" } });
    memory.finished(graphics(3, null));
    await settled();
    expect(writes).toEqual([[2]]);
  });
});
