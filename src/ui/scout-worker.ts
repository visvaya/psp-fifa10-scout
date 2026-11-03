// The worker that parses the user's files off the UI thread: one WorkerRequest in, phase messages
// and one result or failure out.
import { classifyLoadError, LoadFailure, loadScout } from "../logic/load-scout.ts";
import type { WorkerMessage, WorkerRequest } from "../logic/load-scout.ts";

const post = (message: WorkerMessage, transfer: Transferable[] = []): void => {
  globalThis.postMessage(message, { transfer });
};

const handle = async ({ requestId, ...request }: WorkerRequest): Promise<void> => {
  try {
    const result = await loadScout(request, (phase) => {
      post({ type: "phase", requestId, phase });
    });
    post({ type: "done", requestId, result }, [result.gameDb.buffer]);
  } catch (error) {
    const failure = error instanceof LoadFailure ? error.error : classifyLoadError("game", error);
    post({ type: "failed", requestId, error: failure });
  }
};

globalThis.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data);
});
