// FIFA 10 (PSP) career and squads saves (decrypted DATA.BIN): a 16-byte header, then fifa.db table
// data blocks in fixed slots with zero padding. Each chunk: u32 4, u32 table index in fifa.db order,
// u32 block length, the block (u32 rows, u32 fifa.db directory offset, records), u32 + string pool,
// u32 + bitmap with one bit per fifa.db row (set = row replaced). The save is untrusted input.
import { birthdateToDate, readRecords, readString, readTable } from "./ea-db.ts";
import type { EaDb, EaDbRow, EaDbTable } from "./ea-db.ts";
import { SaveFormatError } from "./save-format-error.ts";

const FILE_HEADER_BYTES = 16;
const CHUNK_HEAD_BYTES = 20;
const CHUNK_TAG = 4;
/** String fields at or above this value point into the chunk's own pool. */
const SAVE_STRING_BASE = 0xc7000000;
/** fixtures.game_number and team_manager.last_game_number: days since 1582-10-14, then a 10-bit index. */
const GAME_INDEX_SCALE = 1024;

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

/** How many of the first `count` bits from `offset` are set, LSB first. */
const setBits = (view: DataView, offset: number, count: number): number =>
  Array.from(
    { length: count },
    (_, row) => (view.getUint8(offset + (row >>> 3)) >> (row & 7)) & 1,
  ).reduce((total: number, bit) => total + bit, 0);

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
  const replaced = setBits(view, bitmapOffset, table.rowCount);
  if (replaced !== table.rowCount) {
    if (replaced === 0 && rowCount === 0) return { rows: null, end };
    throw new SaveFormatError(`Save has a partial row bitmap for ${table.name}, not supported`);
  }
  const pool = new DataView(view.buffer, view.byteOffset + poolOffset, poolLength);
  const stringAt = (ref: number): string => {
    if (ref < SAVE_STRING_BASE) return readString(db.view, ref);
    if (ref - SAVE_STRING_BASE >= poolLength) {
      throw new SaveFormatError(`Save string reference is out of range in ${table.name}`);
    }
    return readString(pool, ref - SAVE_STRING_BASE);
  };
  const records = { ...table, rowCount, recordsOffset: offset + CHUNK_HEAD_BYTES };
  return { rows: readRecords(view, records, stringAt), end };
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
    offset = (end + 3) & ~3;
  }
  return replaced;
};

const rowsOf = (db: EaDb, save: CareerSave, name: string): readonly EaDbRow[] =>
  save.get(name) ?? readTable(db, name);

/** A table as the career sees it: the save's rows when it replaces the table, otherwise fifa.db's. */
export const effectiveRows: (db: EaDb, save: CareerSave, name: CareerTable) => readonly EaDbRow[] =
  rowsOf;

const gameDate = (gameNumber: number): Date =>
  birthdateToDate(Math.floor(gameNumber / GAME_INDEX_SCALE));

/** The user team, manager name and date of the last played game, from team_manager. */
export const careerManager = (
  db: EaDb,
  save: CareerSave,
): { teamId: number; managerName: string; lastGameDate: Date } => {
  const user = rowsOf(db, save, "team_manager").find((row) => row["team_id"] !== -1);
  if (user === undefined) throw new SaveFormatError("Save has no user team");
  return {
    teamId: Number(user["team_id"]),
    managerName: `${String(user["firstname"])} ${String(user["surname"])}`.trim(),
    lastGameDate: gameDate(Number(user["last_game_number"])),
  };
};

/**
 * The season's first match day: the earliest fixture in the save, else the last played game. The game
 * ages players to this day for the whole season (docs: career OVR date research), not to today.
 */
export const seasonStartDate = (db: EaDb, save: CareerSave): Date => {
  const games = (save.get("fixtures") ?? []).map((row) => Number(row["game_number"]));
  return games.length === 0 ? careerManager(db, save).lastGameDate : gameDate(Math.min(...games));
};
