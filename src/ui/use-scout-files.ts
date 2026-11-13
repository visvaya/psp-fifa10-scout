// The effects at the edge of the reducer: the parsing worker, the local store and the files the
// user picked. The stored fifa.db and career save load on start, so each is picked once.
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { GameLanguages } from "../logic/game-names.ts";
import { pickLocaleFiles, pickSaveFiles } from "../logic/load-scout.ts";
import type { LoadRequest, SaveFiles, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { actionOf } from "../logic/worker-action.ts";
import type { Preferences, ScoutAction } from "../logic/scout-state.ts";
import type { PlayerNote } from "../logic/player-notes.ts";
import type { WatchEntry } from "../logic/watchlist.ts";
import { openScoutStore } from "../logic/scout-store.ts";
import type { ScoutStore, StoredScout } from "../logic/scout-store.ts";
import { detectBackend } from "./browser-store.ts";
import { createGameMemory, createSaveMemory } from "./load-memory.ts";
import type { LoadStarted } from "./load-memory.ts";

const blobs = ({ dataBin, paramSfo }: SaveFiles<Uint8Array>): SaveFiles<Blob> => ({
  dataBin: new Blob([dataBin.slice()]),
  paramSfo: new Blob([paramSfo.slice()]),
});

/** Opens the browser's backend and the store over it; either failing is reported to onFailed. */
const openStore = async (onFailed: () => void) =>
  openScoutStore(await detectBackend(onFailed), onFailed);

type StoreRun = (opened: ScoutStore) => Promise<void>;

const restore = (dispatch: Dispatch<ScoutAction>, stored: StoredScout) => {
  dispatch({ type: "languages-restored", languages: stored.languages });
  dispatch({ type: "watchlist-restored", watchlist: stored.watchlist });
  dispatch({ type: "notes-restored", notes: stored.notes });
  dispatch({ type: "graphics-loaded", graphics: stored.graphics });
  if (stored.preferences !== null) {
    dispatch({ type: "preferences-restored", preferences: stored.preferences });
  }
};

/** What the app keeps in the store besides the game and the career save; each waits for the store. */
const storeSaves = (withStore: (run: StoreRun) => void) => ({
  savePreferences: (preferences: Preferences) =>
    withStore(async (opened) => opened.savePreferences(preferences)),
  saveLanguages: (languages: GameLanguages) =>
    withStore(async (opened) => opened.saveLanguages(languages)),
  saveWatchlist: (watchlist: readonly WatchEntry[]) =>
    withStore(async (opened) => opened.saveWatchlist(watchlist)),
  saveNotes: (notes: readonly PlayerNote[]) => withStore(async (opened) => opened.saveNotes(notes)),
});

/** How a worker that cannot start, run or reply fails the latest load. */
const workerFailure = (requestId: number): WorkerMessage => ({
  type: "failed",
  requestId,
  error: { stage: "game", kind: "unexpected" },
});

/**
 * The parsing worker; post says false once it is gone. error: its script did not load or run (it
 * catches every failure of a load), so it is dropped and every later load fails at once instead of
 * waiting; messageerror: one reply could not be read, and the worker still runs.
 */
const startWorker = (onMessage: (message: WorkerMessage) => void, onFailed: () => void) => {
  let worker: Worker | null = new Worker(new URL("scout-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", ({ data }: MessageEvent<WorkerMessage>) => {
    onMessage(data);
  });
  worker.addEventListener("error", () => {
    worker?.terminate();
    worker = null;
    onFailed();
  });
  worker.addEventListener("messageerror", onFailed);
  return {
    post: (request: WorkerRequest): boolean => {
      worker?.postMessage(request, []);
      return worker !== null;
    },
    terminate: () => worker?.terminate(),
  };
};

/**
 * Asks the worker for a load's list after signing; a gone worker builds none. The UI asks only after
 * the latest load ended, so the reply comes before the end of any later load.
 */
const requestSigned = (
  dispatch: Dispatch<ScoutAction>,
  worker: Pick<ReturnType<typeof startWorker>, "post"> | null,
  requestId: number,
) => {
  dispatch({ type: "signed-requested" });
  if (worker?.post({ type: "signed", requestId }) !== true)
    dispatch({ type: "signed-built", players: null });
};

export const createSession = (dispatch: Dispatch<ScoutAction>, onStorageFailed: () => void) => {
  let worker: ReturnType<typeof startWorker> | null = null;
  /** The store once open; saves wait for it, so a game picked before it opens is still kept. */
  let store: Promise<ScoutStore> | null = null;
  let lastRequestId = 0;
  /** The save for every load; an attached language file for the next load only. */
  let pending: Pick<LoadRequest, "save" | "locale"> = {};
  const withStore = (run: StoreRun) => void store?.then(run).catch(onStorageFailed);
  const [gameMemory, saveMemory] = [createGameMemory(withStore), createSaveMemory(withStore)];

  const finish = (message: WorkerMessage) => {
    for (const memory of [gameMemory, saveMemory]) memory.finished(message);
    // A bad save must not block the next game load: it falls back to the stored save, if any. An
    // older load's failure says nothing about it.
    const latest = message.requestId === lastRequestId;
    if (latest && message.type === "failed" && message.error.stage === "save")
      pending = saveMemory.kept();
    // The state hears the latest load only: a superseded load's late failure must not end the list
    // after signing that the shown players wait for. That list itself is always theirs: the worker
    // answers before it starts any load asked for later.
    if (latest || message.type === "signed") dispatch(actionOf(message));
  };
  const workerFailed = () => finish(workerFailure(lastRequestId));

  /** Loads the game; a picked file carries its name, the stored one is restored, a reload has neither. */
  const start = (source: Blob, started: LoadStarted = {}) => {
    lastRequestId += 1;
    gameMemory.started(lastRequestId, { source, started });
    saveMemory.started(lastRequestId);
    const request: WorkerRequest = { requestId: lastRequestId, game: source, ...pending };
    pending = pending.save === undefined ? {} : { save: pending.save };
    dispatch({ type: "load-started", requestId: lastRequestId, ...started });
    if (worker?.post(request) !== true) workerFailed();
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

  return {
    /** Starts the worker, restores the stored state; resolves whether a game was stored. */
    open: async (isCancelled: () => boolean): Promise<boolean | null> => {
      worker = startWorker(finish, workerFailed);
      const opening = openStore(onStorageFailed);
      store = opening.then(({ store: opened }) => opened);
      const { stored } = await opening;
      if (isCancelled()) return null;
      restore(dispatch, stored);
      if (stored.careerSave !== null) pending = saveMemory.restored(blobs(stored.careerSave));
      // A game picked while the store opened wins over the stored one.
      if (stored.gameDb !== null && lastRequestId === 0)
        start(new Blob([stored.gameDb.slice()]), { restored: true, gameName: stored.gameName });
      return stored.gameDb !== null;
    },
    close: () => worker?.terminate(),
    requestSigned: () => requestSigned(dispatch, worker, lastRequestId),
    pickGame: (file: File) => start(file, { gameName: file.name }),
    pickSave: (files: readonly File[]) => pickFiles("save", pickSaveFiles(files)),
    pickLocale: (files: readonly File[]) => pickFiles("locale", pickLocaleFiles(files)),
    /** Drops the career save from the session and the store, and reloads the game without it. */
    forgetSave: () => {
      pending = {};
      saveMemory.forget();
      reload();
    },
    ...storeSaves(withStore),
  };
};

/**
 * Opens the store and the worker, restores preferences and the stored game, and loads picked files.
 * storageFailed: the local store failed to open or save, so some of it may not be remembered.
 */
export const useScoutFiles = (dispatch: Dispatch<ScoutAction>) => {
  const [storageFailed, setStorageFailed] = useState(false);
  const [session] = useState(() =>
    createSession(dispatch, () => {
      setStorageFailed(true);
    }),
  );
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
    storageFailed,
    pickGame: session.pickGame,
    pickSave: session.pickSave,
    pickLocale: session.pickLocale,
    forgetSave: session.forgetSave,
    requestSigned: session.requestSigned,
    savePreferences: session.savePreferences,
    saveLanguages: session.saveLanguages,
    saveWatchlist: session.saveWatchlist,
    saveNotes: session.saveNotes,
  };
};
