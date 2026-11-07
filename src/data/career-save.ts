// FIFA 10 (PSP) career and squads saves (decrypted DATA.BIN): a 16-byte header, then fifa.db table
// data blocks in fixed slots with zero padding. Each chunk: u32 4, u32 table index in fifa.db order,
// u32 block length, the block (u32 rows, u32 fifa.db directory offset, records), u32 + string pool,
// u32 + bitmap with one bit per fifa.db row (set = row replaced). The table the game then uses is the
// fifa.db rows left unmarked plus the chunk's rows: a full bitmap replaces the table, a partial one
// replaces or drops single rows, an empty one with rows adds them (a new season's rtsg). The save is
// untrusted input.
import { birthdateToDate, num, readRecords, readTable, stringReader } from "./ea-db.ts";
import type { EaDb, EaDbRow, EaDbTable } from "./ea-db.ts";
import { SaveFormatError } from "./save-format-error.ts";

const FILE_HEADER_BYTES = 16;
const CHUNK_HEAD_BYTES = 20;
const CHUNK_TAG = 4;
/** String fields at or above this value point into the chunk's own pool. */
const SAVE_STRING_BASE = 0xc7000000;
/** fixtures.game_number and team_manager.last_game_number: days since 1582-10-14, then a 10-bit index. */
const GAME_INDEX_SCALE = 1024;
/** formations.position1..11 hold the starting eleven; position12 and 13 the bench codes. */
const STARTING_ELEVEN = 11;

/** Rows of the tables the save replaces, keyed by table name. */
export type CareerSave = ReadonlyMap<string, readonly EaDbRow[]>;

type CareerTable =
  | "teamplayerlinks"
  | "playerstats"
  | "career_overall_history"
  | "career_extra_user_team_info"
  | "career_transfer_list"
  | "career_youth_accademy"
  | "career_players_grown_attributes";

/** Whether the bit of each of the first `count` rows from `offset` is set, LSB first. */
const rowBits = (view: DataView, offset: number, count: number): readonly boolean[] =>
  Array.from(
    { length: count },
    (_, row) => ((view.getUint8(offset + (row >>> 3)) >> (row & 7)) & 1) === 1,
  );

/** The chunk at `offset` of `table`: its rows when it replaces the table, else null, and its end. */
const parseChunk = (
  db: EaDb,
  view: DataView,
  offset: number,
  table: EaDbTable,
): { rows: readonly EaDbRow[] | null; end: number } => {
  const truncated = `Save chunk of ${table.name} is truncated`;
  const u32 = (at: number): number => {
    if (at + 4 > view.byteLength) throw new SaveFormatError(truncated);
    return view.getUint32(at, true);
  };
  const rowCount = u32(offset + 12);
  if (u32(offset + 8) !== 8 + rowCount * table.recordSize) {
    throw new SaveFormatError(`Save block length of ${table.name} does not match its rows`);
  }
  const poolOffset = offset + CHUNK_HEAD_BYTES + rowCount * table.recordSize + 4;
  const poolLength = u32(poolOffset - 4);
  const bitmapOffset = poolOffset + poolLength + 4;
  const bitmapLength = u32(bitmapOffset - 4);
  const end = bitmapOffset + bitmapLength;
  if (end > view.byteLength) throw new SaveFormatError(truncated);
  if (bitmapLength !== Math.ceil(table.rowCount / 8)) {
    throw new SaveFormatError(`Save row bitmap of ${table.name} does not match fifa.db`);
  }
  const marked = rowBits(view, bitmapOffset, table.rowCount);
  if (rowCount === 0 && !marked.includes(true)) return { rows: null, end };
  const poolString = stringReader(
    new DataView(view.buffer, view.byteOffset + poolOffset, poolLength),
  );
  const stringAt = (ref: number): string => {
    if (ref < SAVE_STRING_BASE) return db.stringAt(ref);
    if (ref - SAVE_STRING_BASE >= poolLength) {
      throw new SaveFormatError(`Save string reference is out of range in ${table.name}`);
    }
    return poolString(ref - SAVE_STRING_BASE);
  };
  const records = { ...table, rowCount, recordsOffset: offset + CHUNK_HEAD_BYTES };
  const kept = marked.includes(false)
    ? readTable(db, table.name).filter((_, row) => marked[row] === false)
    : [];
  return { rows: [...kept, ...readRecords(view, records, stringAt)], end };
};

/**
 * The tables a save replaces. Chunks are found by scanning 4-byte steps for the tag; a chunk whose
 * table index is unknown or whose directory offset is not its fifa.db table's (the trailing
 * language.db chunk) is skipped.
 */
export const parseCareerSave = (db: EaDb, bytes: Uint8Array): CareerSave => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const tables = [...db.tables.values()];
  const seen = new Set<string>();
  const replaced = new Map<string, readonly EaDbRow[]>();
  let offset = FILE_HEADER_BYTES;
  while (offset + CHUNK_HEAD_BYTES <= bytes.length) {
    if (view.getUint32(offset, true) !== CHUNK_TAG) {
      offset += 4;
      continue;
    }
    const index = view.getUint32(offset + 4, true);
    const table = tables[index];
    // Not a chunk unless the block also points at its table's directory entry: a stray tag in the
    // padding is skipped instead of rejecting the whole save.
    if (table === undefined || view.getUint32(offset + 16, true) !== table.directoryOffset) {
      offset += 4;
      continue;
    }
    if (seen.has(table.name)) throw new SaveFormatError(`Save holds ${table.name} twice`);
    seen.add(table.name);
    const { rows, end } = parseChunk(db, view, offset, table);
    if (rows !== null) replaced.set(table.name, rows);
    offset = Math.ceil(end / 4) * 4;
  }
  return replaced;
};

const rowsOf = (db: EaDb, save: CareerSave, name: string): readonly EaDbRow[] =>
  save.get(name) ?? readTable(db, name);

/** Like rowsOf, but none when neither the save nor the database has the table. */
const rowsOrNone = (db: EaDb, save: CareerSave, name: string): readonly EaDbRow[] =>
  save.get(name) ?? (db.tables.has(name) ? readTable(db, name) : []);

/** A table as the career sees it: the save's rows when it replaces the table, otherwise fifa.db's. */
export const effectiveRows: (db: EaDb, save: CareerSave, name: CareerTable) => readonly EaDbRow[] =
  rowsOf;

const gameDate = (gameNumber: number): Date =>
  birthdateToDate(Math.floor(gameNumber / GAME_INDEX_SCALE));

/** The currency the career shows money in: 0 euro, 1 pound, 2 dollar. */
export type CurrencyCode = 0 | 1 | 2;

const isCurrencyCode = (code: number): code is CurrencyCode =>
  code === 0 || code === 1 || code === 2;

const MANAGER_COLUMNS = [
  "team_id",
  "firstname",
  "surname",
  "last_game_number",
  "currency",
  "prestige",
  "upgrade_fin",
] as const;

/**
 * The user team, manager name, currency, date of the last played game, prestige and the level of the
 * club's negotiator (upgrade_fin: the game's staff list names the negotiator for it, and its offer
 * message for that part speaks of "your negotiator"), from team_manager.
 */
export const careerManager = (
  db: EaDb,
  save: CareerSave,
): {
  teamId: number;
  managerName: string;
  currency: CurrencyCode;
  lastGameDate: Date;
  prestige: number;
  negotiator: number;
} => {
  const user = rowsOf(db, save, "team_manager").find((row) => row["team_id"] !== -1);
  // The profile and squads saves decrypt and parse like a career save, but have no user team.
  if (user === undefined) throw new SaveFormatError("Save has no user team", "not-career");
  if (!MANAGER_COLUMNS.every((column) => Object.hasOwn(user, column))) {
    throw new SaveFormatError("Database team_manager lacks manager columns");
  }
  const currency = Number(user["currency"]);
  if (!isCurrencyCode(currency))
    throw new SaveFormatError(`Save has unknown currency ${String(currency)}`);
  return {
    currency,
    teamId: Number(user["team_id"]),
    managerName: `${String(user["firstname"])} ${String(user["surname"])}`.trim(),
    lastGameDate: gameDate(Number(user["last_game_number"])),
    prestige: Number(user["prestige"]),
    negotiator: Number(user["upgrade_fin"]),
  };
};

/**
 * The game's shortlist in a career: the save's rows, else the database's (fifa.db's is empty; a database
 * without the table, as in tests, has none).
 */
export const careerShortlist = (db: EaDb, save: CareerSave): readonly EaDbRow[] =>
  rowsOrNone(db, save, "career_shortlist");

/** The players on loan with their parent clubs, read like the shortlist (fifa.db's list is empty). */
export const careerLoans = (db: EaDb, save: CareerSave): readonly EaDbRow[] =>
  rowsOrNone(db, save, "career_loaned_list");

/**
 * The position codes of the user team's starting eleven: its teamwrite formation's position1..11 in
 * formations, the save's rows where it replaces either table. None without that row: the formation only
 * breaks best peak ties, so the save still loads, as without a formation.
 */
export const userFormationCodes = (db: EaDb, save: CareerSave): readonly number[] => {
  const { teamId } = careerManager(db, save);
  const team = rowsOrNone(db, save, "teamwrite").find((row) => row["teamid"] === teamId);
  const formation =
    team &&
    rowsOrNone(db, save, "formations").find((row) => row["formationid"] === team["formationid"]);
  if (formation === undefined) return [];
  return Array.from({ length: STARTING_ELEVEN }, (_, index) =>
    num(formation, `position${String(index + 1)}`),
  );
};

/**
 * The season's first match day: the earliest fixture in the save, else the last played game. The game
 * ages players to this day for the whole season (docs: career OVR date research), not to today.
 */
export const seasonStartDate = (db: EaDb, save: CareerSave): Date => {
  const fixtures = save.get("fixtures") ?? [];
  if (fixtures.length === 0) return careerManager(db, save).lastGameDate;
  const first = fixtures.reduce((min, row) => Math.min(min, Number(row["game_number"])), Infinity);
  if (!Number.isFinite(first)) throw new SaveFormatError("Save fixtures lack game_number");
  return gameDate(first);
};
