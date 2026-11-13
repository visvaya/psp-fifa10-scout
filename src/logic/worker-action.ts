// The parsing worker's messages as actions of the app state.
import type { WorkerMessage } from "./load-scout.ts";
import type { ScoutAction } from "./scout-state.ts";

/** The reducer action for a worker message. */
export const actionOf = (message: WorkerMessage): ScoutAction => {
  const { requestId } = message;
  if (message.type === "phase") return { type: "load-phase", requestId, phase: message.phase };
  if (message.type === "failed") return { type: "load-failed", requestId, error: message.error };
  if (message.type === "signed") return { type: "signed-built", players: message.players };
  if (message.type === "graphics") return { type: "graphics-loaded", graphics: message.graphics };
  const { gameDb: _gameDb, ...result } = message.result;
  return { type: "load-succeeded", requestId, ...result };
};
