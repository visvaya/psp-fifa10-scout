import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  countryKey,
  labelKey,
  MAX_IDX_BYTES,
  MAX_LOC_BYTES,
  leagueKey,
  parseLoc,
  parseStringIdx,
  readLocale,
  teamKey,
} from "./game-locale.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildLoc, buildLocale, buildStringIdx } from "./test-support/synthetic-locale.ts";

// "LOCH", header size 0x14, 0, one section at 0x14; "LOCL", size, 0, two strings at 0x18 and 0x1c
// from the section start: "A" and "Żb" in UTF-16LE, each NUL-terminated and padded to 4 bytes.
const HAND_LOC = Uint8Array.from([
  0x4c, 0x4f, 0x43, 0x48, 0x14, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0x14, 0, 0, 0, 0x4c, 0x4f, 0x43,
  0x4c, 0x24, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0x18, 0, 0, 0, 0x1c, 0, 0, 0, 0x41, 0, 0, 0, 0x7b,
  0x01, 0x62, 0, 0, 0, 0, 0,
]);

const HAND_IDX = Uint8Array.from([
  0x19, 0x05, 0x04, 0x20, 2, 0, 0, 0, 0x05, 0, 0, 0, 1, 0, 0, 0, 0xff, 0xff, 0xff, 0xff, 0, 0, 0, 0,
]);

const patched = (bytes: Uint8Array, offset: number, value: number): Uint8Array => {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
};

/** HAND_LOC with a second "LOCL" tag in its last 4 bytes and the section pointing there. */
const LOCL_AT_END = (() => {
  const copy = patched(HAND_LOC, 16, HAND_LOC.length - 4);
  copy.set([0x4c, 0x4f, 0x43, 0x4c], HAND_LOC.length - 4);
  return copy;
})();

describe("parseLoc", () => {
  it("reads a hand-written string table", () => {
    expect(parseLoc(HAND_LOC)).toEqual(["A", "Żb"]);
  });

  it("round-trips the test builder, including empty strings", () => {
    expect(parseLoc(buildLoc(["Polska", "", "Bayern Monachium\n"]))).toEqual([
      "Polska",
      "",
      "Bayern Monachium\n",
    ]);
  });

  it.each([
    ["a wrong magic", patched(HAND_LOC, 0, 0), "Not a locale file"],
    ["a section outside the file", patched(HAND_LOC, 16, 0x1000), "does not describe"],
    ["a section cut short", LOCL_AT_END, "does not describe"],
    ["a missing LOCL tag", patched(HAND_LOC, 0x14, 0), "does not describe"],
    ["more offsets than the file holds", patched(HAND_LOC, 0x20, 8), "does not describe"],
    ["a string offset outside the file", patched(HAND_LOC, 0x24, 0x500), "out of range"],
    ["a string without its NUL", HAND_LOC.subarray(0, HAND_LOC.length - 4), "out of range"],
    ["a string cut in a character", HAND_LOC.subarray(0, HAND_LOC.length - 3), "out of range"],
    ["a truncated header", HAND_LOC.subarray(0, 19), "too short"],
    ["a header without its section", HAND_LOC.subarray(0, 20), "does not describe"],
  ])("rejects %s", (_name, bytes, message) => {
    expect(() => parseLoc(bytes)).toThrow(SaveFormatError);
    expect(() => parseLoc(bytes)).toThrow(message);
  });

  it("reads tables that end exactly at the file end", () => {
    // A LOCL section with no strings, the file ending right after its head.
    const empty = patched(HAND_LOC.slice(0, 0x24), 0x20, 0);
    expect(parseLoc(empty)).toEqual([]);
    // One offset, 0: the string starts at "LOCL" itself and runs to the zero after the size byte.
    const one = patched(patched(HAND_LOC.slice(0, 0x28), 0x20, 1), 0x24, 0);
    expect(parseLoc(one)).toEqual(["佌䱃$"]);
  });

  it("checks the size cap at its limit", () => {
    expect(() => parseLoc(new Uint8Array(MAX_LOC_BYTES))).toThrow("Not a locale file");
    expect(() => parseStringIdx(new Uint8Array(MAX_IDX_BYTES))).toThrow("Not a string index");
  });

  it("rejects a file over the size cap without reading it", () => {
    expect(() => parseLoc(new Uint8Array(5 * 1024 * 1024))).toThrow("too large");
  });
});

describe("parseStringIdx", () => {
  it("reads a hand-written index", () => {
    expect(parseStringIdx(HAND_IDX)).toEqual([
      [5, 1],
      [0xffffffff, 0],
    ]);
  });

  it.each([
    ["a wrong magic", patched(HAND_IDX, 0, 1), "Not a string index file"],
    ["more entries than the file holds", patched(HAND_IDX, 4, 3), "does not describe"],
    ["a truncated header", HAND_IDX.subarray(0, 7), "too short"],
  ])("rejects %s", (_name, bytes, message) => {
    expect(() => parseStringIdx(bytes)).toThrow(SaveFormatError);
    expect(() => parseStringIdx(bytes)).toThrow(message);
  });

  it("reads an index without entries", () => {
    expect(parseStringIdx(patched(HAND_IDX.slice(0, 8), 4, 0))).toEqual([]);
  });
});

describe("readLocale", () => {
  it("maps each key to its trimmed text", () => {
    const table = readLocale(HAND_LOC, HAND_IDX);
    expect([...table]).toEqual([
      [5, "Żb"],
      [0xffffffff, "A"],
    ]);
    const { loc, idx } = buildLocale([[7, " 2. Bundesliga\n"]]);
    expect(readLocale(loc, idx).get(7)).toBe("2. Bundesliga");
  });

  it("rejects an index that points past the strings", () => {
    expect(() => readLocale(buildLoc(["a"]), buildStringIdx([[1, 1]]))).toThrow(
      "does not describe",
    );
  });
});

describe("name keys", () => {
  it("follow the spec's examples", () => {
    expect(teamKey(1873, 0)).toBe(0x7f1a50d5);
    expect(countryKey(37)).toBe(0xffe6e751);
    expect(leagueKey(66, 3)).toBe(0xa68027b1);
  });

  it("wrap modulo 2^32", () => {
    expect(countryKey(999)).toBe((0xffe6e6e7 + 9 * 33 * 33 + 9 * 33 + 9) % 2 ** 32);
  });
});

describe("labelKey", () => {
  it("keys a label by its English name, as in the game's string index", () => {
    expect(labelKey("GK")).toBe(0x3c6b871);
    expect(labelKey("CB")).toBe(0x3c6b7e4);
    expect(labelKey("RWB")).toBe(0x7c9df72a);
  });

  it("wraps modulo 2^32 for longer names", () => {
    expect(labelKey("RCDM")).toBe(0x105c87e5);
  });
});

// The game files never enter the repository. Point GAME_LOCALE_DIR at an extracted
// PSP_GAME/USRDIR/data/gui/locale directory to check them locally.
const realLocaleDir = process.env["GAME_LOCALE_DIR"] ?? "";

const table = (lang: string) =>
  readLocale(
    readFileSync(path.join(realLocaleDir, `${lang}.loc`)),
    readFileSync(path.join(realLocaleDir, "string.idx")),
  );

const positionNames = (label: string) =>
  ["eng_us", "pol_pl", "cze_cz", "hun_hu"].map((lang) => table(lang).get(labelKey(label)));

describe.runIf(realLocaleDir !== "" && existsSync(realLocaleDir))("real locale files", () => {
  it("names countries, clubs and cups in Polish and Czech", () => {
    const polish = table("pol_pl");
    expect(polish.get(countryKey(37))).toBe("Polska");
    expect(polish.get(teamKey(21, 0))).toBe("Bayern Monachium");
    expect(polish.get(leagueKey(1, 2))).toBe("Puchar Danii");
    expect(table("cze_cz").get(teamKey(1873, 0))).toBe("Visla Krakov");
  });

  it("names positions in every language by their English names", () => {
    expect(positionNames("ST")).toEqual(["ST", "N", "ST", "CS"]);
    expect(positionNames("RCDM")).toEqual(["RCDM", "PŚPD", "PSSZ", "JKVK"]);
    expect(positionNames("LWM")).toEqual(["LWM", "LS", "ZLK", "BOK"]);
  });
});
