// The effects at the edge of the reducer: the parsing worker, the local store and the files the
// user picked. The stored fifa.db is loaded on start, so the game file is picked once.
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { GameLanguages } from "../logic/game-names.ts";
import { pickLocaleFiles, pickSaveFiles } from "../logic/load-scout.ts";
import type { LoadRequest, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { actionOf } from "../logic/scout-state.ts";
import type { Preferences, ScoutAction } from "../logic/scout-state.ts";
import { createScoutStore } from "../logic/scout-store.ts";
import type { ScoutStore, StoredScout } from "../logic/scout-store.ts";
import { detectBackend } from "./browser-store.ts";

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

const createSession = (dispatch: Dispatch<ScoutAction>) => {
  let worker: Worker | null = null;
  /** The store once open; saves wait for it, so a game picked before it opens is still kept. */
  let store: Promise<ScoutStore> | null = null;
  let lastRequestId = 0;
  /** The fifa.db of the last good load. */
  let game: Blob | null = null;
  /** The save for every load; an attached language file for the next load only. */
  let pending: Pick<LoadRequest, "save" | "locale"> = {};
  /** Requests whose game came from a picked file, so their fifa.db goes to the store. */
  const fromFile = new Set<number>();

  const start = (source: Blob, picked = false) => {
    lastRequestId += 1;
    if (picked) fromFile.add(lastRequestId);
    const request: WorkerRequest = { requestId: lastRequestId, game: source, ...pending };
    pending = pending.save === undefined ? {} : { save: pending.save };
    dispatch({ type: "load-started", requestId: lastRequestId });
    worker?.postMessage(request, []);
  };

  /** Keeps picked save or language files for the next load, and reloads the game with them. */
  const pickFiles = <K extends "save" | "locale">(stage: K, picked: LoadRequest[K] | null) => {
    if (picked === null) {
      dispatch({ type: "files-incomplete", stage });
      return;
    }
    pending = { ...pending, [stage]: picked };
    if (game !== null) start(game);
  };

  const onMessage = ({ data: message }: MessageEvent<WorkerMessage>) => {
    // A bad save must not block the next game load.
    if (message.type === "failed" && message.error.stage === "save") pending = {};
    if (message.type === "done") {
      game = new Blob([message.result.gameDb.slice()]);
      if (fromFile.delete(message.requestId))
        void store?.then(async (opened) => opened.saveGameDb(message.result.gameDb));
    }
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
      // A game picked while the store opened wins over the stored one.
      if (stored.gameDb !== null && lastRequestId === 0) start(new Blob([stored.gameDb.slice()]));
      return stored.gameDb !== null;
    },
    close: () => worker?.terminate(),
    pickGame: (file: File) => start(file, true),
    pickSave: (files: readonly File[]) => {
      pickFiles("save", pickSaveFiles(files));
    },
    pickLocale: (files: readonly File[]) => {
      pickFiles("locale", pickLocaleFiles(files));
    },
    savePreferences: (preferences: Preferences) => {
      void store?.then(async (opened) => opened.savePreferences(preferences));
    },
    saveLanguages: (languages: GameLanguages) => {
      void store?.then(async (opened) => opened.saveLanguages(languages));
    },
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
    hasStoredGame: hasStoredGame === true,
    pickGame: session.pickGame,
    pickSave: session.pickSave,
    pickLocale: session.pickLocale,
    savePreferences: session.savePreferences,
    saveLanguages: session.saveLanguages,
  };
};
