import { existsSync } from "node:fs";
import { open } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseEaDb } from "./ea-db.ts";
import { type ReadRange, readGameDatabase, readIsoFile, readIsoLocales } from "./iso9660.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildIso } from "./test-support/synthetic-iso.ts";
import { buildParamSfo, syntheticBytes } from "./test-support/synthetic-save.ts";

const SECTOR = 2048;
const DB_PATH = "PSP_GAME/USRDIR/data/cmn/fifa.db";

/** A database-looking file of three and a half sectors: the fifa.db header, then noise. */
const database = Uint8Array.from([0, 0, 0, 0, 4, 0, 0, 0, ...syntheticBytes(3 * SECTOR + 1000, 7)]);

const gameIso = (discId = "ULES01328", db = database): Uint8Array =>
  buildIso([
    { path: "PSP_GAME/PARAM.SFO", bytes: buildParamSfo([{ key: "DISC_ID", value: discId }]) },
    { path: "PSP_GAME/ICON0.PNG", bytes: syntheticBytes(5000, 3) },
    { path: DB_PATH, bytes: db },
  ]);

const reader = (image: Uint8Array): { read: ReadRange; bytesRead: () => number } => {
  let total = 0;
  return {
    read: (offset, length) => {
      total += length;
      return Promise.resolve(image.slice(offset, offset + length));
    },
    bytesRead: () => total,
  };
};

const u32 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(offset, true);

const dbEntryOffset = (image: Uint8Array): number => {
  // cmn is the fifth directory (sector 22); its third record names fifa.db.
  const offset = 22 * SECTOR + 68;
  expect(new TextDecoder().decode(image.subarray(offset + 33, offset + 42))).toBe("fifa.db;1");
  return offset;
};

describe("synthetic ISO builder", () => {
  it("writes the PVD and directory records at their ISO 9660 offsets", () => {
    const image = gameIso();
    expect([...image.subarray(0x8000, 0x8007)]).toEqual([1, 0x43, 0x44, 0x30, 0x30, 0x31, 1]);
    expect(u32(image, 0x8000 + 80)).toBe(image.length / SECTOR);
    expect(image[0x8000 + 128]).toBe(0x00);
    expect(image[0x8000 + 129]).toBe(0x08);
    const root = 0x8000 + 156;
    expect([image[root], u32(image, root + 2), image[root + 25], image[root + 32]]).toEqual([
      34, 18, 2, 1,
    ]);
    // PSP_GAME (sector 19): ".", "..", then PARAM.SFO;1 (11 name bytes, record 44 bytes).
    const sfo = 19 * SECTOR + 68;
    expect([image[sfo], image[sfo + 25], image[sfo + 32]]).toEqual([44, 0, 11]);
    expect(new TextDecoder().decode(image.subarray(sfo + 33, sfo + 44))).toBe("PARAM.SFO;1");
    const sfoSector = u32(image, sfo + 2);
    expect(sfoSector).toBeGreaterThan(23);
    expect(image[sfoSector * SECTOR + 1]).toBe(0x50); // "P" of "\0PSF"
  });
});

describe("readIsoFile", () => {
  it("returns a nested file spanning several sectors, matching names case-insensitively", async () => {
    const { read } = reader(gameIso());
    expect(await readIsoFile(read, "/psp_game/usrdir/DATA/cmn/FIFA.DB", 1 << 20)).toEqual(database);
  });

  it("matches extensionless names written with a trailing dot", async () => {
    const image = buildIso([{ path: "README.", bytes: Uint8Array.of(9) }]);
    expect(await readIsoFile(reader(image).read, "readme", 10)).toEqual(Uint8Array.of(9));
  });

  const NOT_ISO = "Not an ISO 9660 disc image";
  // No ISO at all is the wrong file; an ISO in a block size the reader cannot handle is unsupported.
  it.each([
    ["an image without CD001", 0x8001, 0x58, { message: NOT_ISO, kind: "wrong-file" }],
    [
      "a volume descriptor that is not primary",
      0x8000,
      2,
      { message: NOT_ISO, kind: "wrong-file" },
    ],
    [
      "a block size other than 2048",
      0x8000 + 129,
      0x04,
      { message: "Unsupported ISO 9660 block size", kind: "damaged" },
    ],
  ])("rejects %s", async (_, offset, value, expected) => {
    const image = gameIso();
    image[offset] = value;
    await expect(readIsoFile(reader(image).read, DB_PATH, 1 << 20)).rejects.toThrow(
      expect.objectContaining(expected),
    );
  });

  it("rejects a truncated image", async () => {
    const image = gameIso().subarray(0, 17 * SECTOR - 1);
    await expect(readIsoFile(reader(image).read, DB_PATH, 1 << 20)).rejects.toThrow("truncated");
  });

  it("strips only the final version suffix and trailing dot of a record name", async () => {
    const image = buildIso([
      { path: "AB;1C;12", bytes: Uint8Array.of(1) },
      { path: "A.B.", bytes: Uint8Array.of(2) },
    ]);
    const { read } = reader(image);
    expect(await readIsoFile(read, "ab;1c", 1)).toEqual(Uint8Array.of(1));
    expect(await readIsoFile(read, "a.b", 1)).toEqual(Uint8Array.of(2));
  });

  it("accepts a record ending exactly at the sector end", async () => {
    const image = buildIso([{ path: "A", bytes: Uint8Array.of(1) }]);
    const root = 18 * SECTOR;
    const record = image.slice(root + 68, root + 68 + 36);
    image.fill(0, root, root + SECTOR);
    // Seven 255-byte records and one 227-byte record leave exactly 36 bytes for "A;1".
    for (let offset = 0; offset < 1785; offset += 255) image[root + offset] = 255;
    image[root + 1785] = 227;
    image.set(record, root + 2012);
    expect(await readIsoFile(reader(image).read, "A", 1)).toEqual(Uint8Array.of(1));
  });

  it("does not read a file as a directory", async () => {
    const inner = buildIso([{ path: "A", bytes: Uint8Array.of(1) }]).slice(
      18 * SECTOR,
      19 * SECTOR,
    );
    const image = buildIso([
      { path: "A", bytes: Uint8Array.of(1) },
      { path: "D", bytes: inner },
    ]);
    await expect(readIsoFile(reader(image).read, "D/A", 1)).rejects.toThrow("Not found");
  });

  it("skips a zero length byte to the next sector of a directory", async () => {
    const image = buildIso([{ path: "A", bytes: Uint8Array.of(1) }]);
    // Grow the root to two sectors and move its file record into the second one.
    const root = 18 * SECTOR;
    const record = image.slice(root + 68, root + 68 + 36);
    image.fill(0, root + 68, root + 68 + 36);
    const view = new DataView(image.buffer);
    view.setUint32(0x8000 + 156 + 10, 2 * SECTOR, true);
    const second = 19 * SECTOR; // the gap sector after the root directory
    image.set(record, second);
    expect(await readIsoFile(reader(image).read, "A", 10)).toEqual(Uint8Array.of(1));
  });

  it("rejects a directory record crossing its sector", async () => {
    const image = buildIso([{ path: "A", bytes: Uint8Array.of(1) }]);
    const root = 18 * SECTOR;
    image.fill(0, root, root + SECTOR);
    // Eight unnamed 255-byte records reach offset 2040, where a 40-byte record would cross the sector.
    for (let offset = 0; offset < 2040; offset += 255) image[root + offset] = 255;
    image[root + 2040] = 40;
    await expect(readIsoFile(reader(image).read, "A", 10)).rejects.toThrow(
      "directory record is out of range",
    );
  });

  it("rejects a directory record past the directory end", async () => {
    const image = buildIso([{ path: "A", bytes: Uint8Array.of(1) }]);
    new DataView(image.buffer).setUint32(0x8000 + 156 + 10, 80, true);
    await expect(readIsoFile(reader(image).read, "A", 10)).rejects.toThrow(
      "directory record is out of range",
    );
  });

  it("rejects a record shorter than its name", async () => {
    const image = gameIso();
    image[19 * SECTOR + 68] = 40;
    await expect(readIsoFile(reader(image).read, "PSP_GAME/PARAM.SFO", 1 << 16)).rejects.toThrow(
      "directory record is out of range",
    );
  });

  it("rejects an extent beyond the volume", async () => {
    const image = gameIso();
    const view = new DataView(image.buffer);
    const entry = dbEntryOffset(image);
    view.setUint32(entry + 2, image.length / SECTOR - 1, true);
    await expect(readIsoFile(reader(image).read, DB_PATH, 1 << 20)).rejects.toThrow(
      "extent is out of range",
    );
  });

  it("accepts an extent ending exactly at the volume end", async () => {
    const image = buildIso([{ path: "A", bytes: Uint8Array.of(5) }]);
    const view = new DataView(image.buffer);
    // The file sits in the second-to-last sector; shrink the volume to end right after it.
    view.setUint32(0x8000 + 80, image.length / SECTOR - 1, true);
    expect(await readIsoFile(reader(image).read, "A", 1)).toEqual(Uint8Array.of(5));
  });

  it("rejects a file larger than the limit before reading it", async () => {
    const { read, bytesRead } = reader(gameIso());
    await expect(readIsoFile(read, DB_PATH, database.length - 1)).rejects.toThrow(
      expect.objectContaining({
        message: "Disc image file is too large",
        kind: "wrong-file",
      }),
    );
    expect(bytesRead()).toBe(6 * SECTOR); // PVD and five directories, no file data
    expect(await readIsoFile(read, DB_PATH, database.length)).toEqual(database);
  });

  it("rejects an oversized directory", async () => {
    const image = gameIso();
    new DataView(image.buffer).setUint32(0x8000 + 156 + 10, 1024 * 1024 + 1, true);
    await expect(readIsoFile(reader(image).read, DB_PATH, 1 << 20)).rejects.toThrow("too large");
  });

  it("reports missing paths, files used as directories and directories used as files", async () => {
    const { read } = reader(gameIso());
    await expect(readIsoFile(read, "PSP_GAME/NOPE", 10)).rejects.toThrow(
      "Not found in the disc image: PSP_GAME/NOPE",
    );
    await expect(readIsoFile(read, "PSP_GAME/PARAM.SFO/X", 10)).rejects.toThrow("Not found");
    await expect(readIsoFile(read, "PSP_GAME/USRDIR", 1 << 20)).rejects.toThrow(
      expect.objectContaining({
        message: "Not a file in the disc image: PSP_GAME/USRDIR",
        kind: "wrong-file",
      }),
    );
  });

  it("throws SaveFormatError", async () => {
    await expect(readIsoFile(reader(new Uint8Array(0)).read, DB_PATH, 1)).rejects.toBeInstanceOf(
      SaveFormatError,
    );
  });
});

describe("readGameDatabase", () => {
  it("reads fifa.db from the game ISO, touching only a small part of the image", async () => {
    const padded = new Uint8Array(64 * 1024 * 1024);
    const image = gameIso();
    padded.set(image);
    new DataView(padded.buffer).setUint32(0x8000 + 80, padded.length / SECTOR, true);
    const { read, bytesRead } = reader(padded);
    expect(await readGameDatabase(read, padded.length)).toEqual(database);
    expect(bytesRead()).toBeLessThan(database.length + 12 * SECTOR);
  });

  it("names the disc id of another game", async () => {
    const image = gameIso("ULUS10450");
    await expect(readGameDatabase(reader(image).read, image.length)).rejects.toMatchObject({
      message: "Disc image is not FIFA 10 ULES01328: found ULUS10450",
      kind: "wrong-game",
    });
  });

  it("rejects an oversized fifa.db inside the ISO", async () => {
    const image = gameIso();
    new DataView(image.buffer).setUint32(dbEntryOffset(image) + 10, 16 * 1024 * 1024 + 1, true);
    await expect(readGameDatabase(reader(image).read, image.length)).rejects.toThrow("too large");
  });

  it("returns a bare fifa.db as it is", async () => {
    expect(await readGameDatabase(reader(database).read, database.length)).toEqual(database);
    const tiny = database.slice(0, 8);
    expect(await readGameDatabase(reader(tiny).read, 8)).toEqual(tiny);
  });

  it("reads a bare fifa.db just shorter than a volume descriptor", async () => {
    const short = new Uint8Array(16 * SECTOR);
    short[4] = 4;
    expect(await readGameDatabase(reader(short).read, short.length)).toEqual(short);
  });

  it("treats a file ending right after the volume descriptor as an ISO", async () => {
    const image = gameIso().slice(0, 17 * SECTOR);
    await expect(readGameDatabase(reader(image).read, image.length)).rejects.toThrow("truncated");
  });

  it("accepts a bare database of exactly 16 MiB", async () => {
    const limit = new Uint8Array(16 * 1024 * 1024);
    limit[4] = 4;
    expect((await readGameDatabase(reader(limit).read, limit.length)).length).toBe(limit.length);
  });

  it("reads a bare fifa.db larger than the volume descriptor offset", async () => {
    const big = new Uint8Array(17 * SECTOR);
    big[4] = 4;
    expect(await readGameDatabase(reader(big).read, big.length)).toEqual(big);
  });

  it("rejects a bare database over 16 MiB", async () => {
    const huge = new Uint8Array(16 * 1024 * 1024 + 1);
    huge[4] = 4;
    await expect(readGameDatabase(reader(huge).read, huge.length)).rejects.toThrow(
      expect.objectContaining({
        message: "Database file is too large",
        kind: "wrong-file",
      }),
    );
  });

  it.each([
    ["an empty file", new Uint8Array(0)],
    ["a near-miss database header", Uint8Array.of(0, 0, 0, 0, 5, 0, 0, 0)],
    ["zeros past the volume descriptor", new Uint8Array(20000)],
  ])("rejects %s", async (_, bytes) => {
    await expect(readGameDatabase(reader(bytes).read, bytes.length)).rejects.toThrow(
      "Not a FIFA 10 disc image or database file",
    );
  });
});

describe("readIsoLocales", () => {
  const LOCALE = "PSP_GAME/USRDIR/data/gui/locale";
  const localeIso = (extra: readonly { path: string; bytes: Uint8Array }[] = []) =>
    buildIso([
      { path: DB_PATH, bytes: database },
      { path: `${LOCALE}/string.idx`, bytes: Uint8Array.of(1, 2) },
      { path: `${LOCALE}/pol_pl.loc`, bytes: Uint8Array.of(3) },
      { path: `${LOCALE}/ENG_US.LOC`, bytes: Uint8Array.of(4) },
      { path: `${LOCALE}/notes.txt`, bytes: Uint8Array.of(5) },
      { path: `${LOCALE}/trivia/cze_cz.loc`, bytes: Uint8Array.of(6) },
      ...extra,
    ]);

  it("lists the main directory's languages and reads their files with the index", async () => {
    const image = localeIso();
    expect(await readIsoLocales(reader(image).read, image.length)).toEqual({
      idx: Uint8Array.of(1, 2),
      languages: [
        ["eng_us", Uint8Array.of(4)],
        ["pol_pl", Uint8Array.of(3)],
      ],
      cgexport: null,
    });
  });

  it("also reads the cgexport directory, which holds the full position names", async () => {
    const image = localeIso([
      { path: `${LOCALE}/cgexport/string.idx`, bytes: Uint8Array.of(7) },
      { path: `${LOCALE}/cgexport/pol_pl.loc`, bytes: Uint8Array.of(8) },
    ]);
    expect((await readIsoLocales(reader(image).read, image.length))?.cgexport).toEqual({
      idx: Uint8Array.of(7),
      languages: [["pol_pl", Uint8Array.of(8)]],
    });
  });

  it("returns null for a bare database, an image without the directory or without an index", async () => {
    const bare = [
      Uint8Array.of(1),
      database,
      new Uint8Array(16 * SECTOR + 100),
      new Uint8Array(17 * SECTOR),
    ];
    const results = await Promise.all(
      bare.map(async (bytes) => readIsoLocales(reader(bytes).read, bytes.length)),
    );
    expect(results).toEqual([null, null, null, null]);
    const noLocale = gameIso();
    expect(await readIsoLocales(reader(noLocale).read, noLocale.length)).toBeNull();
    const noIdx = buildIso([{ path: `${LOCALE}/pol_pl.loc`, bytes: Uint8Array.of(3) }]);
    expect(await readIsoLocales(reader(noIdx).read, noIdx.length)).toBeNull();
    const noLoc = buildIso([{ path: `${LOCALE}/string.idx`, bytes: Uint8Array.of(3) }]);
    expect(await readIsoLocales(reader(noLoc).read, noLoc.length)).toBeNull();
  });

  it("rejects a locale directory with more languages than the cap", async () => {
    const languages = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        path: `${LOCALE}/cgexport/l${String(index)}.loc`,
        bytes: Uint8Array.of(index),
      }));
    const atCap = localeIso([
      { path: `${LOCALE}/cgexport/string.idx`, bytes: Uint8Array.of(7) },
      ...languages(8),
    ]);
    expect(
      (await readIsoLocales(reader(atCap).read, atCap.length))?.cgexport?.languages,
    ).toHaveLength(8);
    const overCap = localeIso([
      { path: `${LOCALE}/cgexport/string.idx`, bytes: Uint8Array.of(7) },
      ...languages(9),
    ]);
    await expect(readIsoLocales(reader(overCap).read, overCap.length)).rejects.toThrow(
      "Disc image lists too many languages",
    );
  });

  it("reports a damaged image instead of hiding it", async () => {
    const image = localeIso();
    // Point the root directory record's extent past the end of the image.
    new DataView(image.buffer).setUint32(16 * SECTOR + 156 + 2, 1_000_000, true);
    await expect(readIsoLocales(reader(image).read, image.length)).rejects.toThrow(SaveFormatError);
  });
});

// The game ISO never enters the repository. Point FIFA_ISO_PATH at it to check it locally.
const realIsoPath = process.env["FIFA_ISO_PATH"] ?? "";

describe.runIf(realIsoPath !== "" && existsSync(realIsoPath))("real ISO from FIFA_ISO_PATH", () => {
  it("extracts fifa.db reading a small part of the image", async () => {
    const handle = await open(realIsoPath);
    try {
      const { size } = await handle.stat();
      let bytesRead = 0;
      const read: ReadRange = async (offset, length) => {
        const buffer = new Uint8Array(length);
        const { bytesRead: count } = await handle.read(buffer, 0, length, offset);
        bytesRead += count;
        return buffer.subarray(0, count);
      };
      const started = performance.now();
      const db = await readGameDatabase(read, size);
      const elapsedMs = performance.now() - started;
      expect(db).toHaveLength(2_750_882);
      expect(parseEaDb(db).tables.size).toBe(88);
      expect(bytesRead).toBeLessThan(3_000_000);
      const locales = await readIsoLocales(read, size);
      expect(locales?.languages.map(([code]) => code)).toEqual([
        "cze_cz",
        "eng_us",
        "hun_hu",
        "pol_pl",
      ]);
      process.stdout.write(
        `real ISO: ${size} bytes, read ${bytesRead} bytes in ${elapsedMs.toFixed(0)} ms`,
      );
    } finally {
      await handle.close();
    }
  });
});
