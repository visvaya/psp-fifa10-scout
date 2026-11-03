import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { careerManager, effectiveRows, parseCareerSave, seasonStartDate } from "./career-save.ts";
import { parseEaDb, readTable } from "./ea-db.ts";
import { buildEaDb } from "./test-support/synthetic-ea-db.ts";
import { buildCareerSave, le32, poolString } from "./test-support/synthetic-career-save.ts";
import type { ChunkSpec } from "./test-support/synthetic-career-save.ts";

const SAVE_STRING = 0xc7000000;

// team_id: 11 bits from -1, MSB first: raw 1874 (team 1873) is 0xEA40_0000, raw 0 (no team) is 0.
const DB_BYTES = buildEaDb([
  {
    name: "team_manager",
    u32: ["last_game_number"],
    strings: ["firstname", "surname"],
    bits: [{ name: "team_id", lo: -1, hi: 2046 }],
    rows: [{ u32: [0], strings: ["Ann", "Kariera"], area: [0, 0, 0, 0] }],
  },
  {
    name: "teamplayerlinks",
    u32: ["teamid", "playerid"],
    rows: [
      { u32: [1, 10], area: [] },
      { u32: [2, 20], area: [] },
    ],
  },
  {
    name: "playerstats",
    u32: ["playerid"],
    rows: Array.from({ length: 9 }, (_, index) => ({ u32: [10 + index], area: [] })),
  },
  { name: "career_transfer_list", u32: ["playerid"], rows: [] },
]);
const DB = parseEaDb(DB_BYTES);
// Directory: 12-byte header, 5 pointers, then entries of 52, 36, 32 and 32 bytes.
const DIR = { team_manager: 32, teamplayerlinks: 84, playerstats: 120, career_transfer_list: 152 };

/** Offset of a string in the database pool, for references that point there. */
const dbString = (text: string): number => {
  const needle = poolString(text).join();
  return DB_BYTES.findIndex(
    (_, at) => [...DB_BYTES.subarray(at, at + 2 + text.length)].join() === needle,
  );
};

// Row 0 has no team; row 1 is the user: firstname from the save pool, surname from fifa.db's pool.
const MANAGERS: ChunkSpec = {
  index: 0,
  directoryOffset: DIR.team_manager,
  rows: 2,
  records: [
    ...le32(0),
    ...le32(dbString("Ann")),
    ...le32(dbString("Ann")),
    0,
    0,
    0,
    0,
    ...le32(0x9839807),
    ...le32(SAVE_STRING),
    ...le32(dbString("Kariera")),
    0xea,
    0x40,
    0,
    0,
  ],
  pool: poolString("Nowy"),
  bitmap: [0x01],
  padding: 8,
};

const LINKS: ChunkSpec = {
  index: 1,
  directoryOffset: DIR.teamplayerlinks,
  rows: 1,
  records: [...le32(1873), ...le32(99)],
  bitmap: [0x03],
  padding: 12,
};

const STATS_CLEAR: ChunkSpec = {
  index: 2,
  directoryOffset: DIR.playerstats,
  rows: 0,
  records: [],
  bitmap: [0, 0],
};

const parse = (chunks: readonly ChunkSpec[]) => parseCareerSave(DB, buildCareerSave(chunks));

describe("parseCareerSave", () => {
  it("reads a hand-written chunk: tag, table index, block length, rows, directory offset", () => {
    // Header (size 44), chunk: tag 4, table 1, length 16, 1 row, directory 84, record (1873, 12),
    // empty pool, 1-byte bitmap 0x03, padding.
    const bytes = Uint8Array.from([
      44, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 0, 16, 0, 0, 0, 1, 0, 0,
      0, 84, 0, 0, 0, 81, 7, 0, 0, 12, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0,
    ]);
    expect(effectiveRows(DB, parseCareerSave(DB, bytes), "teamplayerlinks")).toEqual([
      { teamid: 1873, playerid: 12 },
    ]);
  });

  it("resolves a hand-written save pool reference 0xC7000000 + offset", () => {
    const save = parse([
      {
        ...MANAGERS,
        rows: 1,
        records: [...le32(0), 0, 0, 0, 0xc7, 2, 0, 0, 0xc7, 0xea, 0x40, 0, 0],
        pool: [0, 0, 2, 0, 0x4f, 0x6b],
      },
    ]);
    expect(careerManager(DB, save).managerName).toBe("Ok");
  });

  it("returns the user team, manager and the date of the last played game", () => {
    const manager = careerManager(DB, parse([MANAGERS, LINKS]));
    expect(manager.teamId).toBe(1873);
    expect(manager.managerName).toBe("Nowy Kariera");
    expect(manager.lastGameDate.toISOString().slice(0, 10)).toBe("2009-07-25");
  });

  it("dates the season start by the earliest fixture, else by the last played game", () => {
    const save = parse([MANAGERS]);
    // 0x9839807 is 2009-07-25, game 7; one week earlier is 7 * 1024 lower.
    const fixtures = [0x983b400, 0x9839807 - 7 * 1024, 0x9839807].map((game) =>
      Object.freeze({ game_number: game }),
    );
    const date = (career: typeof save) => seasonStartDate(DB, career).toISOString().slice(0, 10);
    expect(date(new Map([...save, ["fixtures", fixtures]]))).toBe("2009-07-18");
    expect(date(save)).toBe("2009-07-25");
  });

  it("uses the save's rows for a replaced table and fifa.db's otherwise", () => {
    const save = parse([MANAGERS, LINKS, STATS_CLEAR]);
    expect(effectiveRows(DB, save, "teamplayerlinks")).toEqual([{ teamid: 1873, playerid: 99 }]);
    expect(effectiveRows(DB, save, "playerstats")).toEqual(readTable(DB, "playerstats"));
    expect(effectiveRows(DB, parse([]), "teamplayerlinks")).toEqual(
      readTable(DB, "teamplayerlinks"),
    );
  });

  it("skips a chunk whose directory offset belongs to another database", () => {
    const foreign = { ...STATS_CLEAR, index: 0, directoryOffset: 0x14, bitmap: [0, 0, 0] };
    expect(effectiveRows(DB, parse([foreign, LINKS]), "teamplayerlinks")).toHaveLength(1);
  });

  it("rejects a manager table without a user team", () => {
    expect(() => careerManager(DB, parse([]))).toThrow(/no user team/);
  });

  it("reads a bitmap over several bytes and chunks that end at the end of the file", () => {
    const stats = { ...STATS_CLEAR, rows: 1, records: le32(7) };
    expect(effectiveRows(DB, parse([{ ...stats, bitmap: [0xff, 0x01] }]), "playerstats")).toEqual([
      { playerid: 7 },
    ]);
    expect(() => parse([{ ...stats, bitmap: [0xff, 0] }])).toThrow(/partial row bitmap/);
    const transfers = { index: 3, directoryOffset: DIR.career_transfer_list, rows: 1, bitmap: [] };
    const save = parse([{ ...transfers, records: le32(5) }]);
    expect(effectiveRows(DB, save, "career_transfer_list")).toEqual([{ playerid: 5 }]);
    const links = buildCareerSave([LINKS]);
    expect(parseCareerSave(DB, links.subarray(0, links.length - 3)).size).toBe(1);
  });

  it("rejects a truncated chunk", () => {
    const bytes = buildCareerSave([LINKS]);
    for (const cut of [4, 8, 12, 20]) {
      expect(() => parseCareerSave(DB, bytes.subarray(0, bytes.length - cut))).toThrow(
        /teamplayerlinks is truncated/,
      );
    }
  });

  it("rejects a block length that does not match the rows", () => {
    expect(() => parse([{ ...LINKS, length: 20 }])).toThrow(/length of teamplayerlinks/);
  });

  it("skips a block that matches a table but lacks the chunk tag", () => {
    expect(parse([{ ...LINKS, tag: 5 }]).size).toBe(0);
  });

  it("skips a tag with an unknown table index and rejects a repeated table", () => {
    expect(parse([{ ...LINKS, index: 4 }]).size).toBe(0);
    expect(() => parse([LINKS, LINKS])).toThrow(/teamplayerlinks twice/);
  });

  it("rejects a save pool reference out of range", () => {
    const records = [...MANAGERS.records];
    records.splice(20, 4, ...le32(SAVE_STRING + 6));
    expect(() => parse([{ ...MANAGERS, records }])).toThrow(/string reference is out of range/);
  });

  it("rejects partial bitmaps, added rows and a bitmap of the wrong size", () => {
    expect(() => parse([{ ...LINKS, bitmap: [0x01] }])).toThrow(/partial row bitmap/);
    expect(() => parse([{ ...LINKS, bitmap: [0] }])).toThrow(/partial row bitmap/);
    expect(() => parse([{ ...LINKS, rows: 0, records: [], bitmap: [0x01] }])).toThrow(
      /partial row bitmap/,
    );
    expect(() => parse([{ ...LINKS, bitmap: [0x03, 0] }])).toThrow(/bitmap of teamplayerlinks/);
  });
});

// Game data never enters the repository. FIFA_DB_PATH, PSP_CAREER_SAVE and PSP_SQUADS_SAVE (plain
// DATA.BIN files) point at local copies.
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const realCareerPath = process.env["PSP_CAREER_SAVE"] ?? "";
const realSquadsPath = process.env["PSP_SQUADS_SAVE"] ?? "";
const realDb = () => parseEaDb(readFileSync(realDbPath));

describe.runIf(existsSync(realDbPath) && existsSync(realCareerPath))("real career save", () => {
  it("reads the user team, manager, date and the replaced links", () => {
    const db = realDb();
    const save = parseCareerSave(db, readFileSync(realCareerPath));
    const manager = careerManager(db, save);
    expect(manager.teamId).toBe(1873);
    expect(manager.managerName).toBe("Nowy Kariera");
    expect(manager.lastGameDate.toISOString().slice(0, 10)).toBe("2009-07-25");
    const team = readTable(db, "teams").find((row) => row["teamid"] === 1873);
    expect(team?.["teamname"]).toBe("Wisła Kraków");
    const links = effectiveRows(db, save, "teamplayerlinks");
    expect(links).toHaveLength(12858);
    const squad = links.filter((link) => link["teamid"] === 1873);
    expect(effectiveRows(db, save, "career_extra_user_team_info")).toHaveLength(squad.length);
  });

  it.runIf(existsSync(realSquadsPath))("keeps fifa.db's rows for the squads save", () => {
    const db = realDb();
    const save = parseCareerSave(db, readFileSync(realSquadsPath));
    expect(effectiveRows(db, save, "teamplayerlinks")).toEqual(readTable(db, "teamplayerlinks"));
  });
});
