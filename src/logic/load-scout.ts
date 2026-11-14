// Loading the user's files into player summaries, and the worker protocol. The worker turns each picked
// file into a narrow capability (its size and a reader), calls loadScout and posts what it reports;
// loadScout decides what to read, within the size caps, and the UI never parses files on its own thread.
import { offerContextOf } from "./offer.ts";
import type { OfferContext } from "./offer.ts";
import {
  careerManager,
  formationShapes,
  parseCareerSave,
  userFormationCodes,
} from "../data/career-save.ts";
import type { CurrencyCode } from "../data/career-save.ts";
import { num, parseEaDb, readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import { MAX_IDX_BYTES, MAX_LOC_BYTES, readLocale } from "../data/game-locale.ts";
import type { GraphicsPack } from "../data/game-graphics.ts";
import { readGameDatabase, readIsoLocales } from "../data/iso9660.ts";
import type { ReadRange } from "../data/iso9660.ts";
import { MAX_SFO_BYTES } from "../data/param-sfo.ts";
import { MAX_DATA_BIN_BYTES, readSaveData } from "../data/read-save-data.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import type { SaveFormatErrorKind } from "../data/save-format-error.ts";
import { gameNamesOf } from "./game-names.ts";
import type { GameLanguages, NameIds } from "./game-names.ts";
import { readCurves } from "./overall-rating.ts";
import type { Curves } from "./overall-rating.ts";
import { buildPlayers } from "./players.ts";
import type { Player } from "./players.ts";
import type { ProfileMode } from "./player-rating.ts";

export type LoadPhase = "game" | "save" | "players";
export type LoadStage = "game" | "save" | "locale";
export type LoadErrorKind = SaveFormatErrorKind | "unexpected";

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

/** A whole user file: its size, and its contents read only when called. */
export interface FileSource {
  readonly size: number;
  readonly bytes: () => Promise<Uint8Array>;
}

/** What loadScout reads: the game by byte ranges, the save and language files whole. */
export interface LoadInput {
  readonly game: { readonly size: number; readonly read: ReadRange };
  readonly save?: SaveFiles<FileSource>;
  readonly locale?: LocaleFiles<FileSource>;
}

/** What a career save holds, so the user can tell which save was loaded. */
export interface CareerSummary {
  readonly managerName: string;
  /** The user's club as fifa.db names it, null when the save links it to no club. */
  readonly clubName: string | null;
  /** Null before the career's first game. */
  readonly lastGameDate: Date | null;
  /** The currency the career shows money in. */
  readonly currency: CurrencyCode;
  /** The user's side of a transfer offer. */
  readonly offer: OfferContext;
  /** The starting eleven's position codes, which a best peak tie goes by; empty without them. */
  readonly formationCodes: readonly number[];
  /** Every distinct starting eleven of the database's formations (formationShapes), for roadmap 98. */
  readonly formations: readonly (readonly number[])[];
}

export interface LoadResult {
  readonly players: readonly Player[];
  /** The user's club in the career, null without a save. */
  readonly myTeamId: number | null;
  /** The loaded career, null without a save. */
  readonly career: CareerSummary | null;
  /** The game's development curves, for their sparklines. */
  readonly curves: Curves;
  /** The extracted fifa.db, for the local store. */
  readonly gameDb: Uint8Array;
  /** Names of each language in the disc image or the attached file; empty for a bare fifa.db. */
  readonly languages: GameLanguages;
  /** The code of the attached language file, null without one. */
  readonly attachedLanguage: string | null;
}

/** Builds the loaded career's players in a profile: once signed, at the peak or both (signed-list.ts). */
export type SignedBuild = (mode: ProfileMode) => readonly Player[];

/**
 * Messages between the UI and the worker; requestId lets the UI drop results of a superseded load. A
 * "signed" request asks for the list after signing of the players the UI shows (scout-worker.ts). The
 * game's graphics follow a load's "done" in a message of their own, so they never hold up the list.
 */
export type WorkerRequest =
  | (LoadRequest & { readonly requestId: number })
  | { readonly type: "signed"; readonly requestId: number; readonly mode: ProfileMode };
export type WorkerMessage =
  | { readonly type: "phase"; readonly requestId: number; readonly phase: LoadPhase }
  | { readonly type: "done"; readonly requestId: number; readonly result: LoadResult }
  | { readonly type: "failed"; readonly requestId: number; readonly error: LoadError }
  | {
      readonly type: "signed";
      readonly requestId: number;
      /** null: the list could not be built. */
      readonly players: readonly Player[] | null;
      readonly mode: ProfileMode;
    }
  | {
      readonly type: "graphics";
      readonly requestId: number;
      /** null: the game file had none, or they could not be read. */
      readonly graphics: GraphicsPack | null;
    };

/** What went wrong in user terms: only SaveFormatError comes from the file itself. */
export const classifyLoadError = (stage: LoadStage, error: unknown): LoadError => {
  if (!(error instanceof SaveFormatError)) return { stage, kind: "unexpected" };
  return { stage, kind: error.kind };
};

/** The contents of a user file, checking its size before reading it. */
const bytesOf = async (file: FileSource, maxBytes: number): Promise<Uint8Array> => {
  if (file.size > maxBytes) throw new SaveFormatError("File is too large", "wrong-file");
  return file.bytes();
};

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
    readTable(db, table).map((row) => num(row, column));
  return {
    teams: ids("teams", "teamid"),
    leagues: ids("leagues", "leagueid"),
    countries: ids("country", "countryid"),
  };
};

/** The names of the disc image's languages, or of the attached file. */
const readLanguages = async (db: EaDb, { game, locale }: LoadInput): Promise<GameLanguages> => {
  const ids = await atStage("game", () => idsOf(db));
  if (locale !== undefined) {
    return atStage("locale", async () => {
      const table = readLocale(
        await bytesOf(locale.loc, MAX_LOC_BYTES),
        await bytesOf(locale.idx, MAX_IDX_BYTES),
      );
      return { [locale.code]: gameNamesOf(table, ids) };
    });
  }
  return atStage("game", async () => {
    const files = await readIsoLocales(game.read, game.size);
    if (files === null) return {};
    const { cgexport } = files;
    return Object.fromEntries(
      files.languages.map(([code, loc]) => {
        const extra = cgexport?.languages.find(([candidate]) => candidate === code)?.[1];
        const main = readLocale(loc, files.idx);
        // The main directory's texts win over cgexport's, as the game reads them first.
        const table =
          cgexport === null || extra === undefined
            ? main
            : new Map([...readLocale(extra, cgexport.idx), ...main]);
        return [code, gameNamesOf(table, ids)];
      }),
    );
  });
};

/**
 * Reads the game database, its languages and the optional save; throws LoadFailure. onCareer gets the
 * build of the list after signing, for the worker to keep until the UI asks for it.
 */
export const loadScout = async (
  input: LoadInput,
  onPhase: (phase: LoadPhase) => void,
  onCareer?: (build: SignedBuild) => void,
): Promise<LoadResult> => {
  onPhase("game");
  const { game, save } = input;
  const gameDb = await atStage("game", () => readGameDatabase(game.read, game.size));
  const db = await atStage("game", () => parseEaDb(gameDb));
  const names = {
    curves: await atStage("game", () => readCurves(db)),
    languages: await readLanguages(db, input),
    attachedLanguage: input.locale?.code ?? null,
  };
  if (save === undefined) {
    onPhase("players");
    const players = await atStage("game", () => buildPlayers(db));
    return { players, myTeamId: null, career: null, gameDb, ...names };
  }
  onPhase("save");
  const career = await atStage("save", async () =>
    parseCareerSave(
      db,
      readSaveData(
        await bytesOf(save.dataBin, MAX_DATA_BIN_BYTES),
        await bytesOf(save.paramSfo, MAX_SFO_BYTES),
      ),
    ),
  );
  const { teamId, managerName, lastGameDate, currency } = await atStage("save", () =>
    careerManager(db, career),
  );
  onPhase("players");
  const { players, offer } = await atStage("save", () => {
    const built = buildPlayers(db, career, names.curves);
    return { players: built, offer: offerContextOf(db, career, built) };
  });
  onCareer?.((mode) => buildPlayers(db, career, names.curves, mode));
  const clubName = players.find((player) => player.clubId === teamId)?.clubName ?? null;
  return {
    players,
    myTeamId: teamId,
    career: {
      managerName,
      clubName,
      lastGameDate,
      currency,
      offer,
      formationCodes: userFormationCodes(db, career),
      formations: formationShapes(db, career),
    },
    gameDb,
    ...names,
  };
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
