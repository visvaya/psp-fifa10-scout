import { describe, expect, it } from "vitest";
import type { LoadResult, WorkerMessage } from "../logic/load-scout.ts";
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
  };
  const withStore = (run: (opened: MemoryStore) => Promise<void>) => {
    void run(store);
  };
  return { writes, withStore, settled: async () => new Promise((resolve) => setTimeout(resolve)) };
};

const RESULT: LoadResult = {
  players: [],
  myTeamId: null,
  career: null,
  gameDb: Uint8Array.of(9),
  languages: {},
  attachedLanguage: null,
};
const done = (requestId: number): WorkerMessage => ({ type: "done", requestId, result: RESULT });
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

  it("forgets the stored save when the latest load fails on the save", async () => {
    const { writes, withStore, settled } = recordingStore();
    const memory = createSaveMemory(withStore);
    memory.started(1);
    memory.finished({ type: "failed", requestId: 1, error: { stage: "save", kind: "not-career" } });
    await settled();
    expect(writes).toEqual([null]);
  });
});

describe("createGameMemory", () => {
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
});
