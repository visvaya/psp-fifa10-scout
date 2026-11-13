// What the file loads leave in the local store: the fifa.db and the graphics of a picked game file, and
// the career save.
// Loads can overlap (a newer pick supersedes an older load), so only the latest load counts.
import type { SaveFiles, WorkerMessage } from "../logic/load-scout.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { ScoutStore } from "../logic/scout-store.ts";

export type MemoryStore = Pick<ScoutStore, "saveCareerSave" | "saveGameDb" | "saveGraphics">;
export type WithStore = (run: (opened: MemoryStore) => Promise<void>) => void;

/** How a load started: a picked file's name, or the stored game with its name. */
export type LoadStarted = Pick<
  Extract<ScoutAction, { readonly type: "load-started" }>,
  "restored" | "gameName"
>;

export type GameLoad = { readonly source: Blob; readonly started: LoadStarted };

/** A load's end; its phases and the list after signing end none. */
const endsLoad = (
  message: WorkerMessage,
): message is Extract<WorkerMessage, { readonly type: "done" | "failed" }> =>
  message.type === "done" || message.type === "failed";

const bytes = async ({ dataBin, paramSfo }: SaveFiles<Blob>): Promise<SaveFiles<Uint8Array>> => ({
  dataBin: new Uint8Array(await dataBin.arrayBuffer()),
  paramSfo: new Uint8Array(await paramSfo.arrayBuffer()),
});

/**
 * Keeps the store's career save in step: a picked save is stored once the latest load succeeds (it
 * carries over to a load that supersedes its own), a stored save the latest load fails on is dropped
 * while a newly picked one leaves the stored save in place, and a forgotten save never comes back from
 * a load still running. kept: the save in the store as the save for the next load, which a picked save
 * that failed falls back to; restored records the save read from the store and returns it the same way.
 */
export const createSaveMemory = (withStore: WithStore) => {
  let picked: SaveFiles<Blob> | null = null;
  let unsaved: SaveFiles<Blob> | null = null;
  let kept: SaveFiles<Blob> | null = null;
  let latest = 0;
  /** Counts forgets, so a write whose bytes were still being read when the save was forgotten is dropped. */
  let forgets = 0;
  return {
    forget: () => {
      [picked, unsaved, kept, forgets] = [null, null, null, forgets + 1];
      withStore(async (opened) => opened.saveCareerSave(null));
    },
    picked: (save: SaveFiles<Blob> | undefined) => {
      picked = save ?? null;
    },
    restored: (save: SaveFiles<Blob>) => {
      kept = save;
      return { save };
    },
    kept: () => (kept === null ? {} : { save: kept }),
    started: (requestId: number) => {
      [unsaved, picked, latest] = [picked ?? unsaved, null, requestId];
    },
    finished: (message: WorkerMessage) => {
      if (!endsLoad(message) || message.requestId !== latest) return;
      const save = unsaved;
      const savesFailed = message.type === "failed" && message.error.stage === "save";
      // A load that failed before the save keeps it for the next one.
      if (message.type === "done" || savesFailed) unsaved = null;
      if (savesFailed && save === null) {
        kept = null;
        withStore(async (opened) => opened.saveCareerSave(null));
      } else if (message.type === "done" && save !== null) {
        const before = forgets;
        kept = save;
        withStore(async (opened) => {
          const data = await bytes(save);
          if (forgets === before) await opened.saveCareerSave(data);
        });
      }
    },
  };
};

/**
 * The game to load again when a save or language file is picked (the load in progress or the one that
 * failed on the save, else the last good fifa.db), and the fifa.db of the latest load from a picked
 * file, stored under that file's name, with the graphics that load read after it (a load without them
 * leaves the stored ones).
 */
export const createGameMemory = (withStore: WithStore) => {
  const fromFile = new Map<number, string>();
  let [inFlight, latest, game]: [GameLoad | null, number, Blob | null] = [null, 0, null];
  return {
    started: (requestId: number, load: GameLoad) => {
      [inFlight, latest] = [load, requestId];
      const { restored, gameName } = load.started;
      if (restored === undefined && typeof gameName === "string") fromFile.set(requestId, gameName);
    },
    finished: (message: WorkerMessage) => {
      if (message.type === "graphics") {
        const { graphics } = message;
        if (message.requestId === latest && graphics !== null)
          withStore(async (opened) => opened.saveGraphics(graphics));
        return;
      }
      if (!endsLoad(message)) return;
      const name = fromFile.get(message.requestId);
      fromFile.delete(message.requestId);
      if (message.requestId !== latest) return;
      // A load that failed on the save had a good game: a corrected save loads it again.
      if (message.type === "failed" && message.error.stage === "save") return;
      inFlight = null;
      if (message.type !== "done") return;
      game = new Blob([message.result.gameDb.slice()]);
      if (name !== undefined)
        withStore(async (opened) => opened.saveGameDb(message.result.gameDb, name));
    },
    reload: (): GameLoad | null =>
      inFlight ?? (game === null ? null : { source: game, started: {} }),
  };
};
