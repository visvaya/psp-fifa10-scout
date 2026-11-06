// The worker that parses the user's files off the UI thread: one WorkerRequest in, phase messages
// and one result or failure out. It reads the picked files; loadScout decides what to read.
import { classifyLoadError, LoadFailure, loadScout } from "../logic/load-scout.ts";
import type {
  FileSource,
  LoadInput,
  LoadRequest,
  WorkerMessage,
  WorkerRequest,
} from "../logic/load-scout.ts";

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

const fileSource = (blob: Blob): FileSource => ({ size: blob.size, bytes: () => bytesOf(blob) });

const inputOf = ({ game, save, locale }: LoadRequest): LoadInput => ({
  game: {
    size: game.size,
    read: (offset, length) => bytesOf(game.slice(offset, offset + length)),
  },
  ...(save && { save: { dataBin: fileSource(save.dataBin), paramSfo: fileSource(save.paramSfo) } }),
  ...(locale && {
    locale: { ...locale, loc: fileSource(locale.loc), idx: fileSource(locale.idx) },
  }),
});

const post = (message: WorkerMessage, transfer: Transferable[] = []): void => {
  globalThis.postMessage(message, { transfer });
};

const handle = async ({ requestId, ...request }: WorkerRequest): Promise<void> => {
  try {
    const result = await loadScout(inputOf(request), (phase) => {
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
