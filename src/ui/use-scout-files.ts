// The effects at the edge of the reducer: the parsing worker, the local store and the files the
// user picked. The stored fifa.db and career save load on start, so each is picked once.
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { GameLanguages } from "../logic/game-names.ts";
import { pickLocaleFiles, pickSaveFiles } from "../logic/load-scout.ts";
import type { LoadRequest, SaveFiles, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { actionOf } from "../logic/scout-state.ts";
import type { Preferences, ScoutAction } from "../logic/scout-state.ts";
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
});

const createSession = (dispatch: Dispatch<ScoutAction>, onStorageFailed: () => void) => {
  /** The store once open; saves wait for it, so a game picked before it opens is still kept. */
  let [worker, store]: [Worker | null, Promise<ScoutStore> | null] = [null, null];
  let lastRequestId = 0;
  /** The save for every load; an attached language file for the next load only. */
  let pending: Pick<LoadRequest, "save" | "locale"> = {};
  const withStore = (run: StoreRun) => void store?.then(run).catch(onStorageFailed);
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
    // A bad save must not block the next game load; an older load's failure says nothing about it.
    const latest = message.requestId === lastRequestId;
    if (latest && message.type === "failed" && message.error.stage === "save") pending = {};
    for (const memory of [gameMemory, saveMemory]) memory.finished(message);
    dispatch(actionOf(message));
  };

  return {
    /** Starts the worker, restores the stored state; resolves whether a game was stored. */
    open: async (isCancelled: () => boolean): Promise<boolean | null> => {
      worker = new Worker(new URL("scout-worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("message", onMessage);
      const opening = openStore(onStorageFailed);
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
    savePreferences: session.savePreferences,
    saveLanguages: session.saveLanguages,
    saveWatchlist: session.saveWatchlist,
  };
};
