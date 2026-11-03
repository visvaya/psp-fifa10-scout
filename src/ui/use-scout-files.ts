// The effects at the edge of the reducer: the parsing worker, the local store and the files the
// user picked. The stored fifa.db and career save load on start, so each is picked once.
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { GameLanguages } from "../logic/game-names.ts";
import { pickLocaleFiles, pickSaveFiles } from "../logic/load-scout.ts";
import type { LoadRequest, SaveFiles, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { actionOf } from "../logic/scout-state.ts";
import type { Preferences, ScoutAction } from "../logic/scout-state.ts";
import { createScoutStore } from "../logic/scout-store.ts";
import type { ScoutStore, StoredScout } from "../logic/scout-store.ts";
import { detectBackend } from "./browser-store.ts";

const blobs = ({ dataBin, paramSfo }: SaveFiles<Uint8Array>): SaveFiles<Blob> => ({
  dataBin: new Blob([dataBin.slice()]),
  paramSfo: new Blob([paramSfo.slice()]),
});

const bytes = async ({ dataBin, paramSfo }: SaveFiles<Blob>): Promise<SaveFiles<Uint8Array>> => ({
  dataBin: new Uint8Array(await dataBin.arrayBuffer()),
  paramSfo: new Uint8Array(await paramSfo.arrayBuffer()),
});

const openStore = async () => {
  const store = createScoutStore(await detectBackend());
  return { store, stored: await store.load() };
};

const restore = (dispatch: Dispatch<ScoutAction>, stored: StoredScout) => {
  dispatch({ type: "languages-restored", languages: stored.languages });
  if (stored.preferences !== null) {
    dispatch({ type: "preferences-restored", preferences: stored.preferences });
  }
};

/** How a load started: a picked file's name, or the stored game with its name. */
type LoadStarted = Pick<
  Extract<ScoutAction, { readonly type: "load-started" }>,
  "restored" | "gameName"
>;

type WithStore = (run: (opened: ScoutStore) => Promise<void>) => void;

/** Keeps the store's career save in step: a picked save is stored once it loads, a failing one is dropped. */
const createSaveMemory = (withStore: WithStore) => {
  let picked: SaveFiles<Blob> | null = null;
  const loading = new Map<number, SaveFiles<Blob>>();
  const forget = () => {
    withStore(async (opened) => opened.saveCareerSave(null));
  };
  return {
    forget,
    picked: (save: SaveFiles<Blob> | undefined) => {
      picked = save ?? null;
    },
    /** The request that loads the picked save. */
    started: (requestId: number) => {
      if (picked !== null) loading.set(requestId, picked);
      picked = null;
    },
    finished: (message: WorkerMessage) => {
      if (message.type === "phase") return;
      const save = loading.get(message.requestId);
      loading.delete(message.requestId);
      if (message.type === "failed" && message.error.stage === "save") forget();
      else if (message.type === "done" && save !== undefined)
        withStore(async (opened) => opened.saveCareerSave(await bytes(save)));
    },
  };
};

type GameLoad = { readonly source: Blob; readonly started: LoadStarted };

/**
 * The game to load again when a save or language file is picked (the load in progress, else the last
 * good fifa.db), and the fifa.db of each load from a picked file, stored under that file's name.
 */
const createGameMemory = (withStore: WithStore) => {
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
      if (message.requestId === latest) inFlight = null;
      if (message.type !== "done") return;
      game = new Blob([message.result.gameDb.slice()]);
      if (name !== undefined)
        withStore(async (opened) => opened.saveGameDb(message.result.gameDb, name));
    },
    reload: (): GameLoad | null =>
      inFlight ?? (game === null ? null : { source: game, started: {} }),
  };
};

const createSession = (dispatch: Dispatch<ScoutAction>) => {
  /** The store once open; saves wait for it, so a game picked before it opens is still kept. */
  let [worker, store]: [Worker | null, Promise<ScoutStore> | null] = [null, null];
  let lastRequestId = 0;
  /** The save for every load; an attached language file for the next load only. */
  let pending: Pick<LoadRequest, "save" | "locale"> = {};
  const withStore: WithStore = (run) => void store?.then(run);
  const [gameMemory, saveMemory] = [createGameMemory(withStore), createSaveMemory(withStore)];

  /** Loads the game; a picked file carries its name, the stored one is restored, a reload has neither. */
  const start = (source: Blob, started: LoadStarted = {}) => {
    lastRequestId += 1;
    gameMemory.started(lastRequestId, { source, started });
    saveMemory.started(lastRequestId);
    const request: WorkerRequest = { requestId: lastRequestId, game: source, ...pending };
    pending = pending.save === undefined ? {} : { save: pending.save };
    dispatch({ type: "load-started", requestId: lastRequestId, ...started });
    worker?.postMessage(request, []);
  };

  /** Loads the game again, so picked or forgotten files apply. */
  const reload = () => {
    const again = gameMemory.reload();
    if (again !== null) start(again.source, again.started);
  };

  /** Keeps picked save or language files for the next load, and reloads the game with them. */
  const pickFiles = <K extends "save" | "locale">(stage: K, picked: LoadRequest[K] | null) => {
    if (picked === null) return dispatch({ type: "files-incomplete", stage });
    pending = { ...pending, [stage]: picked };
    if (stage === "save") saveMemory.picked(pending.save);
    reload();
  };

  const onMessage = ({ data: message }: MessageEvent<WorkerMessage>) => {
    // A bad save must not block the next game load.
    if (message.type === "failed" && message.error.stage === "save") pending = {};
    gameMemory.finished(message);
    saveMemory.finished(message);
    dispatch(actionOf(message));
  };

  return {
    /** Starts the worker, restores the stored state; resolves whether a game was stored. */
    open: async (isCancelled: () => boolean): Promise<boolean | null> => {
      worker = new Worker(new URL("scout-worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("message", onMessage);
      const opening = openStore();
      store = opening.then(({ store: opened }) => opened);
      const { stored } = await opening;
      if (isCancelled()) return null;
      restore(dispatch, stored);
      if (stored.careerSave !== null) pending = { save: blobs(stored.careerSave) };
      // A game picked while the store opened wins over the stored one.
      if (stored.gameDb !== null && lastRequestId === 0)
        start(new Blob([stored.gameDb.slice()]), { restored: true, gameName: stored.gameName });
      return stored.gameDb !== null;
    },
    close: () => worker?.terminate(),
    pickGame: (file: File) => start(file, { gameName: file.name }),
    pickSave: (files: readonly File[]) => pickFiles("save", pickSaveFiles(files)),
    pickLocale: (files: readonly File[]) => pickFiles("locale", pickLocaleFiles(files)),
    /** Drops the career save from the session and the store, and reloads the game without it. */
    forgetSave: () => {
      pending = {};
      saveMemory.forget();
      reload();
    },
    savePreferences: (preferences: Preferences) =>
      withStore(async (opened) => opened.savePreferences(preferences)),
    saveLanguages: (languages: GameLanguages) =>
      withStore(async (opened) => opened.saveLanguages(languages)),
  };
};

/** Opens the store and the worker, restores preferences and the stored game, and loads picked files. */
export const useScoutFiles = (dispatch: Dispatch<ScoutAction>) => {
  const [session] = useState(() => createSession(dispatch));
  const [hasStoredGame, setHasStoredGame] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void session
      .open(() => cancelled)
      .then((stored) => {
        if (stored !== null) setHasStoredGame(stored);
      });
    return () => {
      cancelled = true;
      session.close();
    };
  }, [session]);

  return {
    ready: hasStoredGame !== null,
    pickGame: session.pickGame,
    pickSave: session.pickSave,
    pickLocale: session.pickLocale,
    forgetSave: session.forgetSave,
    savePreferences: session.savePreferences,
    saveLanguages: session.saveLanguages,
  };
};
