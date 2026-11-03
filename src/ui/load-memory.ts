// What the file loads leave in the local store: the fifa.db of a picked game file and the career save.
// Loads can overlap (a newer pick supersedes an older load), so only the latest load counts.
import type { SaveFiles, WorkerMessage } from "../logic/load-scout.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { ScoutStore } from "../logic/scout-store.ts";

export type MemoryStore = Pick<ScoutStore, "saveCareerSave" | "saveGameDb">;
export type WithStore = (run: (opened: MemoryStore) => Promise<void>) => void;

/** How a load started: a picked file's name, or the stored game with its name. */
export type LoadStarted = Pick<
  Extract<ScoutAction, { readonly type: "load-started" }>,
  "restored" | "gameName"
>;

export type GameLoad = { readonly source: Blob; readonly started: LoadStarted };

const bytes = async ({ dataBin, paramSfo }: SaveFiles<Blob>): Promise<SaveFiles<Uint8Array>> => ({
  dataBin: new Uint8Array(await dataBin.arrayBuffer()),
  paramSfo: new Uint8Array(await paramSfo.arrayBuffer()),
});

/**
 * Keeps the store's career save in step: a picked save is stored once the latest load succeeds (it
 * carries over to a load that supersedes its own), a save the latest load fails on is dropped, and a
 * forgotten save never comes back from a load still running.
 */
export const createSaveMemory = (withStore: WithStore) => {
  let picked: SaveFiles<Blob> | null = null;
  let unsaved: SaveFiles<Blob> | null = null;
  let latest = 0;
  return {
    forget: () => {
      [picked, unsaved] = [null, null];
      withStore(async (opened) => opened.saveCareerSave(null));
    },
    picked: (save: SaveFiles<Blob> | undefined) => {
      picked = save ?? null;
    },
    started: (requestId: number) => {
      [unsaved, picked, latest] = [picked ?? unsaved, null, requestId];
    },
    finished: (message: WorkerMessage) => {
      if (message.type === "phase" || message.requestId !== latest) return;
      const save = unsaved;
      unsaved = null;
      if (message.type === "failed" && message.error.stage === "save")
        withStore(async (opened) => opened.saveCareerSave(null));
      else if (message.type === "done" && save !== null)
        withStore(async (opened) => opened.saveCareerSave(await bytes(save)));
    },
  };
};

/**
 * The game to load again when a save or language file is picked (the load in progress, else the last
 * good fifa.db), and the fifa.db of the latest load from a picked file, stored under that file's name.
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
      if (message.type === "phase") return;
      const name = fromFile.get(message.requestId);
      fromFile.delete(message.requestId);
      if (message.requestId !== latest) return;
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
