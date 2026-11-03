// Loading the user's files into player summaries: the pure part of the worker protocol. The worker
// calls loadScout and posts what it reports; the UI never parses files on its own thread.
import { careerManager, parseCareerSave } from "../data/career-save.ts";
import { parseEaDb, readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import { readLocale } from "../data/game-locale.ts";
import { readGameDatabase, readIsoLocales } from "../data/iso9660.ts";
import type { ReadRange } from "../data/iso9660.ts";
import { readSaveData } from "../data/read-save-data.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { gameNamesOf } from "./game-names.ts";
import type { GameLanguages, NameIds } from "./game-names.ts";
import { buildPlayers } from "./players.ts";
import type { Player } from "./players.ts";

export type LoadPhase = "game" | "save" | "players";
export type LoadStage = "game" | "save" | "locale";
export type LoadErrorKind = "wrong-game" | "wrong-file" | "damaged" | "unexpected";

export interface LoadError {
  readonly stage: LoadStage;
  readonly kind: LoadErrorKind;
}

export interface SaveFiles<T> {
  readonly dataBin: T;
  readonly paramSfo: T;
}

/** A language file the user attached: one <lang>.loc and the string.idx of its directory. */
export interface LocaleFiles<T> {
  readonly code: string;
  readonly loc: T;
  readonly idx: T;
}

export interface LoadRequest {
  /** The ISO image, a bare fifa.db or the stored fifa.db bytes. */
  readonly game: Blob;
  readonly save?: SaveFiles<Blob>;
  readonly locale?: LocaleFiles<Blob>;
}

export interface LoadResult {
  readonly players: readonly Player[];
  /** The user's club in the career, null without a save. */
  readonly myTeamId: number | null;
  /** The extracted fifa.db, for the local store. */
  readonly gameDb: Uint8Array;
  /** Names of each language in the disc image or the attached file; empty for a bare fifa.db. */
  readonly languages: GameLanguages;
  /** The code of the attached language file, null without one. */
  readonly attachedLanguage: string | null;
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

const idsOf = (db: EaDb): NameIds => {
  const ids = (table: string, column: string) =>
    readTable(db, table).map((row) => Number(row[column]));
  return {
    teams: ids("teams", "teamid"),
    leagues: ids("leagues", "leagueid"),
    countries: ids("country", "countryid"),
  };
};

/** The names of the disc image's languages, or of the attached file. */
const readLanguages = async (
  db: EaDb,
  read: ReadRange,
  { game, locale }: LoadRequest,
): Promise<GameLanguages> => {
  const ids = idsOf(db);
  if (locale !== undefined) {
    return atStage("locale", async () => {
      const table = readLocale(await bytesOf(locale.loc), await bytesOf(locale.idx));
      return { [locale.code]: gameNamesOf(table, ids) };
    });
  }
  return atStage("game", async () => {
    const files = await readIsoLocales(read, game.size);
    if (files === null) return {};
    return Object.fromEntries(
      files.languages.map(([code, loc]) => [code, gameNamesOf(readLocale(loc, files.idx), ids)]),
    );
  });
};

/** Reads the game database, its languages and the optional save; throws LoadFailure. */
export const loadScout = async (
  request: LoadRequest,
  onPhase: (phase: LoadPhase) => void,
): Promise<LoadResult> => {
  onPhase("game");
  const { game, save } = request;
  const read: ReadRange = async (offset, length) => bytesOf(game.slice(offset, offset + length));
  const gameDb = await atStage("game", () => readGameDatabase(read, game.size));
  const db = await atStage("game", () => parseEaDb(gameDb));
  const names = {
    languages: await readLanguages(db, read, request),
    attachedLanguage: request.locale?.code ?? null,
  };
  if (save === undefined) {
    onPhase("players");
    return { players: buildPlayers(db), myTeamId: null, gameDb, ...names };
  }
  onPhase("save");
  const career = await atStage("save", async () =>
    parseCareerSave(db, readSaveData(await bytesOf(save.dataBin), await bytesOf(save.paramSfo))),
  );
  const myTeamId = await atStage("save", () => careerManager(db, career).teamId);
  onPhase("players");
  return { players: buildPlayers(db, career), myTeamId, gameDb, ...names };
};

/** DATA.BIN and PARAM.SFO among the picked files (iOS has no folder picker), or null. */
export const pickSaveFiles = <T extends { readonly name: string }>(
  files: readonly T[],
): SaveFiles<T> | null => {
  const named = (name: string) => files.find((file) => file.name.toUpperCase() === name);
  const [dataBin, paramSfo] = [named("DATA.BIN"), named("PARAM.SFO")];
  return dataBin === undefined || paramSfo === undefined ? null : { dataBin, paramSfo };
};

/** A <lang>.loc and string.idx among the picked files, the language code from the .loc name, or null. */
export const pickLocaleFiles = <T extends { readonly name: string }>(
  files: readonly T[],
): LocaleFiles<T> | null => {
  const idx = files.find((file) => file.name.toLowerCase() === "string.idx");
  const loc = files.find((file) => file.name.toLowerCase().endsWith(".loc"));
  return idx === undefined || loc === undefined
    ? null
    : { code: loc.name.slice(0, -".loc".length).toLowerCase(), loc, idx };
};
