import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ageOn, birthdateToDate, parseEaDb, readTable } from "./ea-db.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildEaDb } from "./test-support/synthetic-ea-db.ts";
import type { TableSpec } from "./test-support/synthetic-ea-db.ts";

// Bit area vector from the format notes: 0010001|100001|00101|0 with widths 7/6/5/1.
const LINKS: TableSpec = {
  name: "teamplayerlinks",
  u32: ["teamid", "playerid"],
  bits: [
    { name: "jerseynumber", lo: 1, hi: 99 },
    { name: "position", lo: 0, hi: 33 },
    { name: "yearcontractvalidtil", lo: 2005, hi: 2036 },
    { name: "transferdone", lo: 0, hi: 1 },
  ],
  rows: [{ u32: [7, 1234], area: [0x23, 0x09, 0x40, 0x00] }],
};

// A 32-bit range (0, -1) is a little-endian word; 0x00023997 = 145815.
const PEOPLE: TableSpec = {
  name: "people",
  raw: ["opaque"],
  strings: ["firstname", "surname"],
  bits: [
    { name: "birthdate", lo: 0, hi: -1 },
    { name: "flag", lo: 0, hi: 1 },
  ],
  rows: [
    {
      raw: [0xdeadbeef],
      strings: ["", "Zażółć"],
      area: [0x97, 0x39, 0x02, 0x00, 0x80, 0, 0, 0],
    },
  ],
};

// lo == hi takes 1 bit; a signed lo shifts the stored value: raw 6 in 29 bits after 1 bit is 0x18.
const RANGES: TableSpec = {
  name: "ranges",
  bits: [
    { name: "fixed", lo: 0, hi: 0 },
    { name: "teamid", lo: -1, hi: 268435455 },
  ],
  rows: [{ area: [0, 0, 0, 0x18] }, { area: [0, 0, 0, 0] }],
};

// 4 + 12 + 20 bits: the second field crosses a byte, the third a word: 1010 1011 1100 1101 1110 ...
const CROSSING: TableSpec = {
  name: "crossing",
  bits: [
    { name: "a", lo: 0, hi: 15 },
    { name: "b", lo: 0, hi: 4095 },
    { name: "c", lo: 0, hi: 0xfffff },
  ],
  rows: [{ area: [0xab, 0xcd, 0xef, 0x01, 0x20, 0, 0, 0] }],
};

const EMPTY: TableSpec = { name: "empty", u32: ["id"], rows: [] };

const SAMPLE = buildEaDb([LINKS, PEOPLE, RANGES, CROSSING, EMPTY]);

const patched = (bytes: Uint8Array, offset: number, value: number): Uint8Array => {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
};

/** Offset of the data block of table `index` (its pointer follows the lookup pointer at 0x0C). */
const blockOf = (bytes: Uint8Array, index: number): number =>
  new DataView(bytes.buffer).getUint32(16 + 4 * index, true);

/**
 * A one-table file whose last byte is the end of its data block, so bounds checks meet the file end:
 * header and pointers (0..20), entry with one u32 field (20..52), names "t" and "id" (52..60), block.
 */
const tightDb = (rows: number, records: number): Uint8Array => {
  const bytes = new Uint8Array(68 + 4 * records);
  const view = new DataView(bytes.buffer);
  [0, 4, 1, 52, 60].forEach((word, index) => view.setUint32(4 * index, word, true));
  [52, 0, 4, 1, 0, 0, 0, 55].forEach((word, index) => view.setUint32(20 + 4 * index, word, true));
  bytes.set([1, 0, 0x74, 2, 0, 0x69, 0x64], 52);
  view.setUint32(60, rows, true);
  view.setUint32(64, 20, true);
  return bytes;
};

describe("parseEaDb", () => {
  it("accepts structures that end exactly at the end of the file", () => {
    expect(
      parseEaDb(Uint8Array.from([0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 16, 0, 0, 0])).tables.size,
    ).toBe(0);
    expect(parseEaDb(tightDb(0, 0)).tables.get("t")).toMatchObject({
      rowCount: 0,
      directoryOffset: 20,
    });
    expect(readTable(parseEaDb(tightDb(1, 1)), "t")).toEqual([{ id: 0 }]);
    expect(() => parseEaDb(tightDb(2, 1))).toThrow(/rows of t are out of range/);
  });

  it("lists every table with its row count, record size and fields", () => {
    const tables = parseEaDb(SAMPLE).tables;
    expect([...tables.keys()]).toEqual([
      "teamplayerlinks",
      "people",
      "ranges",
      "crossing",
      "empty",
    ]);
    const links = tables.get("teamplayerlinks");
    expect(links?.rowCount).toBe(1);
    expect(links?.recordSize).toBe(12);
    expect(links?.fields).toEqual([
      { name: "teamid", kind: "u32", bits: 32, bitOffset: 0 },
      { name: "playerid", kind: "u32", bits: 32, bitOffset: 32 },
      { name: "jerseynumber", kind: "bits", bits: 7, bitOffset: 64, lo: 1, hi: 99 },
      { name: "position", kind: "bits", bits: 6, bitOffset: 71, lo: 0, hi: 33 },
      { name: "yearcontractvalidtil", kind: "bits", bits: 5, bitOffset: 77, lo: 2005, hi: 2036 },
      { name: "transferdone", kind: "bits", bits: 1, bitOffset: 82, lo: 0, hi: 1 },
    ]);
    expect(tables.get("people")?.fields.map((field) => [field.kind, field.bits])).toEqual([
      ["raw32", 32],
      ["string", 32],
      ["string", 32],
      ["bits", 32],
      ["bits", 1],
    ]);
    expect(tables.get("ranges")?.fields.map((field) => field.bits)).toEqual([1, 29]);
    expect(tables.get("empty")?.rowCount).toBe(0);
  });

  it("rejects a truncated header or table list", () => {
    expect(() => parseEaDb(new Uint8Array(11))).toThrow(/too short/);
    expect(() => parseEaDb(new Uint8Array(12))).toThrow(/table list is out of range/);
    expect(() => parseEaDb(patched(SAMPLE, 8, 0x10000000))).toThrow(/table list is out of range/);
    expect(() => parseEaDb(SAMPLE.subarray(0, 40))).toThrow(SaveFormatError);
  });

  it("rejects a directory that does not end at the lookup block or has the wrong count", () => {
    expect(() => parseEaDb(patched(SAMPLE, 12, 0x40))).toThrow(/directory does not match/);
    // The first entry ends at 36 + 28 + 4 * 8 + 6 * 4 = 120: one entry for five tables.
    const fewer = patched(SAMPLE, 12, 120);
    expect(() => parseEaDb(fewer)).toThrow(/directory does not match/);
    const lookup = new DataView(SAMPLE.buffer).getUint32(12, true);
    expect(() => parseEaDb(patched(SAMPLE, 12, lookup - 4))).toThrow(/directory does not match/);
  });

  it("rejects offsets out of range", () => {
    expect(() => parseEaDb(patched(SAMPLE, 16, SAMPLE.length - 2))).toThrow(/out of range/);
    expect(() => parseEaDb(patched(SAMPLE, 12, SAMPLE.length + 4))).toThrow(
      /directory is out of range/,
    );
    const rows = patched(SAMPLE, blockOf(SAMPLE, 0), 0x01000000);
    expect(() => parseEaDb(rows)).toThrow(/rows of teamplayerlinks are out of range/);
  });

  it("rejects a data block that points to no directory entry", () => {
    const block = blockOf(SAMPLE, 0);
    expect(() => parseEaDb(patched(SAMPLE, block + 4, block))).toThrow(/points to no table/);
  });

  it("rejects an entry whose field lists run past the file", () => {
    // Field counts of the first entry (at 0x24) start at its word 3.
    expect(() => parseEaDb(patched(SAMPLE, 0x24 + 12, 0x01000000))).toThrow(
      /entry teamplayerlinks is out of range/,
    );
  });

  it("rejects a record size inconsistent with the field widths", () => {
    const bad = buildEaDb([{ ...LINKS, recordSize: 16, rows: [] }]);
    expect(() => parseEaDb(bad)).toThrow(/record size of teamplayerlinks/);
  });

  it("rejects a table without fields that claims rows", () => {
    const bare = buildEaDb([{ name: "country", rows: [] }]);
    expect(() => parseEaDb(patched(bare, blockOf(bare, 0), 0xffffffff))).toThrow(
      /table country has no fields/,
    );
  });

  it("rejects a 32-bit field that is not byte aligned", () => {
    const bad = buildEaDb([
      {
        name: "odd",
        bits: [
          { name: "flag", lo: 0, hi: 1 },
          { name: "word", lo: 0, hi: -1 },
        ],
        rows: [],
        recordSize: 8,
      },
    ]);
    expect(() => parseEaDb(bad)).toThrow(/word is not byte aligned/);
  });
});

describe("readTable", () => {
  const db = parseEaDb(SAMPLE);

  it("decodes the bit area MSB first", () => {
    expect(readTable(db, "teamplayerlinks")).toEqual([
      {
        teamid: 7,
        playerid: 1234,
        jerseynumber: 18,
        position: 33,
        yearcontractvalidtil: 2010,
        transferdone: 0,
      },
    ]);
  });

  it("reads 32-bit fields little-endian, opaque words as numbers and UTF-8 strings", () => {
    expect(readTable(db, "people")).toEqual([
      { opaque: 0xdeadbeef, firstname: "", surname: "Zażółć", birthdate: 145815, flag: 1 },
    ]);
  });

  it("applies degenerate and signed ranges", () => {
    expect(readTable(db, "ranges")).toEqual([
      { fixed: 0, teamid: 5 },
      { fixed: 0, teamid: -1 },
    ]);
  });

  it("reads fields that cross byte and word boundaries", () => {
    expect(readTable(db, "crossing")).toEqual([{ a: 0xa, b: 0xbcd, c: 0xef012 }]);
  });

  it("returns frozen rows and no rows for an empty table", () => {
    expect(Object.isFrozen(readTable(db, "crossing")[0])).toBe(true);
    expect(readTable(db, "empty")).toEqual([]);
  });

  it("names a missing table", () => {
    expect(() => readTable(db, "nope")).toThrow(/no table "nope"/);
  });

  it("rejects string offsets and lengths out of range", () => {
    const record = blockOf(SAMPLE, 1) + 8;
    const surname = record + 8;
    const offset = patched(SAMPLE, surname, SAMPLE.length - 1);
    expect(() => readTable(parseEaDb(offset), "people")).toThrow(/out of range/);
    const length = patched(SAMPLE, surname, SAMPLE.length - 2);
    expect(() => readTable(parseEaDb(length), "people")).toThrow(/string is out of range/);
  });
});

describe("string budget", () => {
  // Records of one string field point into a run of 4s, where every u16 reads as length 0x0404.
  const RUN_LENGTH = 0x404;
  const ROWS = 300;
  const base = buildEaDb([
    {
      name: "names",
      strings: ["name"],
      rows: Array.from({ length: ROWS }, () => ({ strings: [""], area: [] })),
    },
  ]);
  const withRefs = (ref: (row: number) => number): Uint8Array => {
    const bytes = new Uint8Array(base.length + 2 + RUN_LENGTH + ROWS).fill(4);
    bytes.set(base);
    const view = new DataView(bytes.buffer);
    const records = blockOf(bytes, 0) + 8;
    Array.from({ length: ROWS }, (_, row) => view.setUint32(records + 4 * row, ref(row), true));
    return bytes;
  };

  it("decodes a string shared by every record once", () => {
    const rows = readTable(parseEaDb(withRefs(() => base.length)), "names");
    expect(rows).toHaveLength(ROWS);
    expect(new Set(rows.map((row) => row["name"]))).toEqual(
      new Set([String.fromCharCode(4).repeat(RUN_LENGTH)]),
    );
  });

  it("bounds the decoded text to the file size", () => {
    const overlapping = parseEaDb(withRefs((row) => base.length + row));
    expect(() => readTable(overlapping, "names")).toThrow(/strings overlap/);
  });
});

describe("birthdates", () => {
  it("counts days from 1582-10-14", () => {
    expect(birthdateToDate(0).toISOString().slice(0, 10)).toBe("1582-10-14");
    expect(birthdateToDate(145815).toISOString().slice(0, 10)).toBe("1982-01-05");
  });

  it("computes full years of age on a date", () => {
    const born = new Date(Date.UTC(1990, 5, 15));
    expect(ageOn(born, new Date(Date.UTC(2009, 5, 14)))).toBe(18);
    expect(ageOn(born, new Date(Date.UTC(2009, 5, 15)))).toBe(19);
    expect(ageOn(born, new Date(Date.UTC(2009, 4, 20)))).toBe(18);
    expect(ageOn(born, new Date(Date.UTC(2009, 6, 1)))).toBe(19);
  });
});

// The game database never enters the repository. Point FIFA_DB_PATH at fifa.db to check it locally.
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";

describe.runIf(realDbPath !== "" && existsSync(realDbPath))(
  "real fifa.db from FIFA_DB_PATH",
  () => {
    it("reads the catalogue and well-known players", () => {
      const db = parseEaDb(readFileSync(realDbPath));
      expect(db.tables.size).toBe(88);
      const players = readTable(db, "players");
      expect(players).toHaveLength(26090);
      expect(readTable(db, "teams")).toHaveLength(585);
      const links = readTable(db, "teamplayerlinks");
      expect(links).toHaveLength(13884);
      const messi = players.find((row) => row["playerid"] === 158023);
      expect(birthdateToDate(Number(messi?.["birthdate"])).toISOString().slice(0, 10)).toBe(
        "1987-06-24",
      );
      expect(messi?.["potential"]).toBe(95);
      const teamIds = new Set(
        links.filter((row) => row["playerid"] === 188545).map((row) => row["teamid"]),
      );
      const teamNames = readTable(db, "teams")
        .filter((row) => teamIds.has(row["teamid"] ?? -1))
        .map((row) => row["teamname"]);
      expect(teamNames).toContain("Lech Poznań");
    });
  },
);
