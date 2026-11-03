// The effects at the edge of the reducer: the parsing worker, the local store and the files the
// user picked. The stored fifa.db is loaded on start, so the game file is picked once.
import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import { pickSaveFiles } from "../logic/load-scout.ts";
import type { SaveFiles, WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";
import { actionOf } from "../logic/scout-state.ts";
import type { Preferences, ScoutAction } from "../logic/scout-state.ts";
import { createScoutStore } from "../logic/scout-store.ts";
import type { ScoutStore } from "../logic/scout-store.ts";
import { detectBackend } from "./browser-store.ts";

const openStore = async () => {
  const store = createScoutStore(await detectBackend());
  return { store, stored: await store.load() };
};

const createSession = (dispatch: Dispatch<ScoutAction>) => {
  let worker: Worker | null = null;
  let store: ScoutStore | null = null;
  let lastRequestId = 0;
  /** The fifa.db of the last good load. */
  let game: Blob | null = null;
  let save: SaveFiles<Blob> | undefined;
  /** Requests whose game came from a picked file, so their fifa.db goes to the store. */
  const fromFile = new Set<number>();

  const start = (source: Blob, picked = false) => {
    lastRequestId += 1;
    if (picked) fromFile.add(lastRequestId);
    const request: WorkerRequest = {
      requestId: lastRequestId,
      game: source,
      ...(save && { save }),
    };
    dispatch({ type: "load-started", requestId: lastRequestId });
    worker?.postMessage(request, []);
  };

  const onMessage = ({ data: message }: MessageEvent<WorkerMessage>) => {
    // A bad save must not block the next game load.
    if (message.type === "failed" && message.error.stage === "save") save = undefined;
    if (message.type === "done") {
      game = new Blob([message.result.gameDb.slice()]);
      if (fromFile.delete(message.requestId)) void store?.saveGameDb(message.result.gameDb);
    }
    dispatch(actionOf(message));
  };

  return {
    /** Starts the worker, restores the stored state; resolves whether a game was stored. */
    open: async (isCancelled: () => boolean): Promise<boolean | null> => {
      worker = new Worker(new URL("scout-worker.ts", import.meta.url), { type: "module" });
      worker.addEventListener("message", onMessage);
      const { store: opened, stored } = await openStore();
      if (isCancelled()) return null;
      store = opened;
      if (stored.preferences !== null) {
        dispatch({ type: "preferences-restored", preferences: stored.preferences });
      }
      if (stored.gameDb !== null) start(new Blob([stored.gameDb.slice()]));
      return stored.gameDb !== null;
    },
    close: () => {
      worker?.terminate();
    },
    pickGame: (file: File) => {
      start(file, true);
    },
    pickSave: (files: readonly File[]) => {
      const picked = pickSaveFiles(files);
      if (picked === null) {
        dispatch({ type: "save-incomplete" });
        return;
      }
      save = picked;
      if (game !== null) start(game);
    },
    savePreferences: (preferences: Preferences) => {
      void store?.savePreferences(preferences);
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
    savePreferences: session.savePreferences,
  };
};
