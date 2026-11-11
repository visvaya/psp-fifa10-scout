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

/** The id of the latest load asked for: a load it superseded changes nothing here. */
let latestLoad = 0;
/**
 * The list after signing of the players the UI shows: those of the latest load that succeeded, built
 * only when the UI asks for it; null after a load without a career. A failed load leaves it.
 */
let signed: SignedBuild | null = null;

const handleSigned = (requestId: number): void => {
  let players: readonly Player[] | null = null;
  try {
    players = signed?.() ?? null;
  } catch {
    // A list that cannot be built leaves the players before signing; the UI says so.
  }
  post({ type: "signed", requestId, players });
};

const handle = async ({ requestId, ...request }: LoadRequest & { requestId: number }) => {
  latestLoad = requestId;
  const career: { build?: SignedBuild } = {};
  try {
    const result = await loadScout(
      inputOf(request),
      (phase) => {
        post({ type: "phase", requestId, phase });
      },
      (build) => {
        career.build = build;
      },
    );
    const kept = requestId === latestLoad && career.build !== undefined;
    if (requestId === latestLoad) signed = career.build ?? null;
    // The bytes go to the UI without a copy, which detaches them here; the list after signing still
    // reads the database, so a kept career's load sends a copy and keeps them.
    const gameDb = kept ? result.gameDb.slice() : result.gameDb;
    post({ type: "done", requestId, result: { ...result, gameDb } }, [gameDb.buffer]);
  } catch (error) {
    const failure = error instanceof LoadFailure ? error.error : classifyLoadError("game", error);
    post({ type: "failed", requestId, error: failure });
  }
};

globalThis.addEventListener("message", ({ data }: MessageEvent<WorkerRequest>) => {
  if ("type" in data) handleSigned(data.requestId);
  else void handle(data);
});
