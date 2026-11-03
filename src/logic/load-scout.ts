// Loading the user's files into player summaries: the pure part of the worker protocol. The worker
// calls loadScout and posts what it reports; the UI never parses files on its own thread.
import { careerManager, parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { readGameDatabase } from "../data/iso9660.ts";
import { readSaveData } from "../data/read-save-data.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { buildPlayers } from "./players.ts";
import type { Player } from "./players.ts";

export type LoadPhase = "game" | "save" | "players";
export type LoadStage = "game" | "save";
export type LoadErrorKind = "wrong-game" | "wrong-file" | "damaged" | "unexpected";

export interface LoadError {
  readonly stage: LoadStage;
  readonly kind: LoadErrorKind;
}

export interface SaveFiles<T> {
  readonly dataBin: T;
  readonly paramSfo: T;
}

export interface LoadRequest {
  /** The ISO image, a bare fifa.db or the stored fifa.db bytes. */
  readonly game: Blob;
  readonly save?: SaveFiles<Blob>;
}

export interface LoadResult {
  readonly players: readonly Player[];
  /** The user's club in the career, null without a save. */
  readonly myTeamId: number | null;
  /** The extracted fifa.db, for the local store. */
  readonly gameDb: Uint8Array;
}

/** Messages between the UI and the worker; requestId lets the UI drop results of a superseded load. */
export type WorkerRequest = LoadRequest & { readonly requestId: number };
export type WorkerMessage =
  | { readonly type: "phase"; readonly requestId: number; readonly phase: LoadPhase }
  | { readonly type: "done"; readonly requestId: number; readonly result: LoadResult }
  | { readonly type: "failed"; readonly requestId: number; readonly error: LoadError };

const KIND_PATTERNS: readonly (readonly [LoadErrorKind, RegExp])[] = [
  ["wrong-game", /not FIFA 10|wrong game/u],
  ["wrong-file", /^Not an? |too short|too large|does not describe|lists no/u],
];

/** What went wrong in user terms: only SaveFormatError comes from the file itself. */
export const classifyLoadError = (stage: LoadStage, error: unknown): LoadError => {
  if (!(error instanceof SaveFormatError)) return { stage, kind: "unexpected" };
  const kind = KIND_PATTERNS.find(([, pattern]) => pattern.test(error.message))?.[0];
  return { stage, kind: kind ?? "damaged" };
};

const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

/** A load that failed, with what went wrong in user terms. */
export class LoadFailure extends Error {
  override readonly name = "LoadFailure";
  readonly error: LoadError;

  constructor(error: LoadError, cause: unknown) {
    super(`Load failed at ${error.stage}: ${error.kind}`, { cause });
    this.error = error;
  }
}

const atStage = async <T>(stage: LoadStage, run: () => T | Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw new LoadFailure(classifyLoadError(stage, error), error);
  }
};

/** Reads the game database and the optional save; throws LoadFailure. */
export const loadScout = async (
  request: LoadRequest,
  onPhase: (phase: LoadPhase) => void,
): Promise<LoadResult> => {
  onPhase("game");
  const { game, save } = request;
  const gameDb = await atStage("game", () =>
    readGameDatabase(
      async (offset, length) => bytesOf(game.slice(offset, offset + length)),
      game.size,
    ),
  );
  const db = await atStage("game", () => parseEaDb(gameDb));
  if (save === undefined) {
    onPhase("players");
    return { players: buildPlayers(db), myTeamId: null, gameDb };
  }
  onPhase("save");
  const career = await atStage("save", async () =>
    parseCareerSave(db, readSaveData(await bytesOf(save.dataBin), await bytesOf(save.paramSfo))),
  );
  const myTeamId = await atStage("save", () => careerManager(db, career).teamId);
  onPhase("players");
  return { players: buildPlayers(db, career), myTeamId, gameDb };
};

/** DATA.BIN and PARAM.SFO among the picked files (iOS has no folder picker), or null. */
export const pickSaveFiles = <T extends { readonly name: string }>(
  files: readonly T[],
): SaveFiles<T> | null => {
  const named = (name: string) => files.find((file) => file.name.toUpperCase() === name);
  const [dataBin, paramSfo] = [named("DATA.BIN"), named("PARAM.SFO")];
  return dataBin === undefined || paramSfo === undefined ? null : { dataBin, paramSfo };
};
