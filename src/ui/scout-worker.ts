// The worker that parses the user's files off the UI thread: one WorkerRequest in, phase messages
// and one result or failure out. It reads the picked files; loadScout decides what to read. It keeps
// the latest career's list after signing unbuilt until a "signed" request asks for it.
import { classifyLoadError, LoadFailure, loadScout } from "../logic/load-scout.ts";
import type {
  FileSource,
  LoadInput,
  LoadRequest,
  SignedBuild,
  WorkerMessage,
  WorkerRequest,
} from "../logic/load-scout.ts";
import type { Player } from "../logic/players.ts";

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

/** The latest career load's list after signing, built only when the UI asks for it. */
let signed: { readonly requestId: number; readonly build: SignedBuild } | null = null;

const handleSigned = (requestId: number): void => {
  let players: readonly Player[] | null = null;
  try {
    if (signed?.requestId === requestId) players = signed.build();
  } catch {
    // A list that cannot be built leaves the players before signing; the UI says so.
  }
  post({ type: "signed", requestId, players });
};

const handle = async ({ requestId, ...request }: LoadRequest & { requestId: number }) => {
  signed = null;
  try {
    const result = await loadScout(
      inputOf(request),
      (phase) => {
        post({ type: "phase", requestId, phase });
      },
      (build) => {
        signed = { requestId, build };
      },
    );
    post({ type: "done", requestId, result }, [result.gameDb.buffer]);
  } catch (error) {
    const failure = error instanceof LoadFailure ? error.error : classifyLoadError("game", error);
    post({ type: "failed", requestId, error: failure });
  }
};

globalThis.addEventListener("message", ({ data }: MessageEvent<WorkerRequest>) => {
  if ("type" in data) handleSigned(data.requestId);
  else void handle(data);
});
