import { describe, expect, it } from "vitest";
import { decodeShpm, parseBig4, readGameGraphics, unrefpack } from "./game-graphics.ts";
import type { ReadRange } from "./iso9660.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildBig4, buildShpm, refpackLiterals } from "./test-support/synthetic-graphics.ts";
import { buildIso } from "./test-support/synthetic-iso.ts";

const ascii = (text: string): Uint8Array => new TextEncoder().encode(text);
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** A copy of `bytes` with one byte changed. */
const at = (bytes: Uint8Array, offset: number, value: number): Uint8Array => {
  const copy = bytes.slice();
  copy[offset] = value;
  return copy;
};
/** A copy of `bytes` with one u32 LE changed. */
const u32 = (bytes: Uint8Array, offset: number, value: number): Uint8Array => {
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
};
const reader =
  (image: Uint8Array): ReadRange =>
  async (offset, length) =>
    Promise.resolve(image.slice(offset, offset + length));

/** An archive of these entries back to back after `gap` bytes, and its BIG4 table. */
const archive = (entries: readonly (readonly [string, string])[], gap = 3) => {
  const bytes: number[] = Array.from({ length: gap }, () => 0xee);
  const table: [string, number, number][] = [];
  for (const [name, contents] of entries) {
    table.push([name, bytes.length, contents.length]);
    bytes.push(...ascii(contents));
  }
  return { data: Uint8Array.from(bytes), table: buildBig4(table) };
};

describe("parseBig4", () => {
  it("reads each entry's offset, size and name", () => {
    const table = buildBig4([
      ["tl1873.msh", 0x10, 300],
      ["ls37.msh", 0x1_00_00_00_00 - 1, 5],
    ]);
    expect([...parseBig4(table)]).toEqual([
      ["tl1873.msh", { offset: 0x10, size: 300 }],
      ["ls37.msh", { offset: 0xff_ff_ff_ff, size: 5 }],
    ]);
  });

  it.each([
    ["no BIG4 magic", buildBig4([]).fill(0x46, 3, 4)],
    ["a table shorter than its header", buildBig4([]).subarray(0, 15)],
  ])("rejects %s", (_, table) => {
    expect(() => parseBig4(table)).toThrow(
      expect.objectContaining({ name: "SaveFormatError", message: "Not a BIG4 table" }),
    );
  });

  it("rejects a name without its terminator and a count past the end", () => {
    const table = buildBig4([["a.msh", 0, 1]]);
    expect(() => parseBig4(table.subarray(0, table.length - 1))).toThrow(
      expect.objectContaining({ message: "BIG4 entry is out of range" }),
    );
    new DataView(table.buffer).setUint32(8, 2, false);
    expect(() => parseBig4(table)).toThrow(SaveFormatError);
  });
});

describe("unrefpack", () => {
  it("restores a stream of literal blocks and the stop code's last bytes", () => {
    const plain = Uint8Array.from({ length: 233 }, (_, index) => index);
    expect(unrefpack(refpackLiterals(plain), 1000)).toEqual(plain);
    expect(unrefpack(refpackLiterals(new Uint8Array(0)), 0)).toEqual(new Uint8Array(0));
  });

  // "abcd", then each back-reference form: short (1 literal, 3 from 4 back), medium (4 from 8 back),
  // long (5 from 2 back, overlapping what it writes), then the stop code with one literal.
  const commands = [
    [0xe0, ...ascii("abcd")],
    [0x01, 3, ...ascii("e")],
    [0x80, 0x00, 7],
    [0xc0, 0, 1, 0],
    [0xfd, ...ascii("z")],
  ].flat();
  const expected = "abcdebcdabcdcdcdcz";

  it("copies every back-reference form", () => {
    expect(text(unrefpack(Uint8Array.of(0x10, 0xfb, 0, 0, 18, ...commands), 64))).toBe(expected);
  });

  it("skips the compressed size (flag bit 0) and reads a 4-byte size (flag bit 7)", () => {
    const stream = Uint8Array.of(0x81, 0xfb, 9, 9, 9, 0, 0, 0, 18, ...commands);
    expect(text(unrefpack(stream, 64))).toBe(expected);
  });

  it.each([
    ["no RefPack marker", [0x10, 0xfa, 0, 0, 0, 0xfc], "Not a RefPack stream"],
    ["a header cut short", [0x10, 0xfb, 0, 0], "RefPack stream is truncated"],
    ["a size over the cap", [0x10, 0xfb, 0, 0, 65, 0xfc], "RefPack output is too large"],
    ["a back-reference before the start", [0x10, 0xfb, 0, 0, 3, 0x00, 0, 0xfc], "out of range"],
    ["a copy past the size", [0x10, 0xfb, 0, 0, 3, 0x01, 0, 0x61, 0xfc], "out of range"],
    ["literals past the size", [0x10, 0xfb, 0, 0, 1, 0xfe, 1, 2], "out of range"],
    ["literals past the end", [0x10, 0xfb, 0, 0, 4, 0xe0, 1, 2], "out of range"],
    ["no stop code", [0x10, 0xfb, 0, 0, 4, 0xe0, 1, 2, 3, 4], "RefPack stream is truncated"],
    ["a stop before the size", [0x10, 0xfb, 0, 0, 2, 0xfd, 1], "RefPack output is short"],
  ])("rejects %s", (_, bytes, message) => {
    const unpack = () => unrefpack(Uint8Array.from(bytes), 64);
    expect(unpack).toThrow(SaveFormatError);
    expect(unpack).toThrow(message);
  });
});

describe("decodeShpm", () => {
  const RED = [255, 0, 0, 255];
  const CLEAR = [0, 0, 0, 0];
  const BLUE = [0, 0, 255, 128];
  const image = () => buildShpm(2, 2, [1, 0, 2, 1], [CLEAR, RED, BLUE]);

  it("turns the indexed pixels of padded rows into RGBA through the palette", () => {
    expect(decodeShpm(image())).toEqual({
      width: 2,
      height: 2,
      rgba: Uint8ClampedArray.from([...RED, ...CLEAR, ...BLUE, ...RED]),
    });
  });

  it("reads rows wider than one 16-byte step", () => {
    const pixels = Array.from({ length: 17 * 2 }, (_, index) => index % 3);
    const { rgba } = decodeShpm(buildShpm(17, 2, pixels, [CLEAR, RED, BLUE]));
    expect([...rgba.subarray(17 * 4, 18 * 4)]).toEqual(BLUE);
  });

  // The image block starts at 32: type, 3-byte size, width at 36, height at 38; the palette at 32 + 48.
  it.each([
    ["no SHPM magic", at(image(), 0, 0x53 + 1), "Not an SHPM image"],
    ["no image", u32(image(), 8, 0), "Not an SHPM image"],
    ["a file shorter than its directory", image().slice(0, 23), "Not an SHPM image"],
    ["an image offset past the end", u32(image(), 20, 2000), "SHPM image is out of range"],
    ["another image type", at(image(), 32, 0x5e), "Unsupported SHPM image type 0x5e"],
    ["a zero height", at(image(), 38, 0), "SHPM image is out of range"],
    ["a zero width", at(image(), 36, 0), "SHPM image is out of range"],
    ["rows narrower than the width", at(image(), 36, 17), "SHPM image is out of range"],
    ["rows of no whole size", at(image(), 33, 47), "SHPM image is out of range"],
    ["no palette after the image", at(image(), 80, 0x3c), "SHPM palette is out of range"],
    ["a palette cut short", image().slice(0, -1), "SHPM palette is out of range"],
  ])("rejects %s", (_, bytes, message) => {
    expect(() => decodeShpm(bytes)).toThrow(
      expect.objectContaining({ name: "SaveFormatError", message }),
    );
  });
});

describe("readGameGraphics", () => {
  const GUI = "PSP_GAME/USRDIR/data/gui";
  const BOOT = "PSP_GAME/USRDIR/data/preload/bootpreloaded.big";
  const base = archive([
    ["tl1873.msh", "crest"],
    ["menu.msh", "skip"],
    ["ll31.msh", "logo"],
    ["s_00012345.msh", "face"],
    ["s_123.msh", "skip"],
    ["g_1230456.msh", "built"],
  ]);
  const fe = archive([
    ["ls37.msh", "flag"],
    ["j0_01873.msh", "home"],
    ["j1_01873.msh", "away"],
    ["j2_01873.msh", "skip"],
  ]);

  /** The boot archive: its own table, then cro_base.bgh as one of its entries. */
  const bootArchive = (tableBytes = base.table) => {
    const head = buildBig4([
      ["other", 0, 1],
      ["cro_base.bgh", 1000, tableBytes.length],
    ]);
    const bytes = new Uint8Array(1000 + tableBytes.length);
    bytes.set(head);
    bytes.set(tableBytes, 1000);
    return bytes;
  };

  const iso = (boot: Uint8Array = bootArchive()) =>
    buildIso([
      { path: BOOT, bytes: boot },
      { path: `${GUI}/cro_base.bgb`, bytes: base.data },
      { path: `${GUI}/cro_feonly.bgh`, bytes: fe.table },
      { path: `${GUI}/cro_feonly.bgb`, bytes: fe.data },
    ]);

  it("packs the crests, logos, portraits, flags and kits, without their .msh", async () => {
    const image = iso();
    const pack = await readGameGraphics(reader(image), image.length);
    expect(pack?.entries.map(([name]) => name)).toEqual([
      "tl1873",
      "ll31",
      "s_00012345",
      "g_1230456",
      "ls37",
      "j0_01873",
      "j1_01873",
    ]);
    const contents = pack?.entries.map(([, offset, length]) =>
      text(pack.bytes.subarray(offset, offset + length)),
    );
    expect(contents).toEqual(["crest", "logo", "face", "built", "flag", "home", "away"]);
    expect(pack?.bytes.length).toBe(30);
  });

  it("reads each archive with one read", async () => {
    const image = iso();
    const lengths: number[] = [];
    await readGameGraphics(async (offset, length) => {
      lengths.push(length);
      return reader(image)(offset, length);
    }, image.length);
    expect(lengths).toContain(base.data.length);
    expect(lengths).toContain(fe.data.length);
  });

  it("returns null for a bare fifa.db", async () => {
    const db = Uint8Array.of(0, 0, 0, 0, 4, 0, 0, 0);
    expect(await readGameGraphics(reader(db), db.length)).toBeNull();
  });

  it("rejects a boot archive without the table of cro_base", async () => {
    const image = iso(buildBig4([["other", 0, 1]]));
    await expect(readGameGraphics(reader(image), image.length)).rejects.toThrow(
      "Disc image has no graphics table",
    );
  });

  it.each([
    ["the table of cro_base past its archive", () => bootArchive().subarray(0, 1001)],
    [
      "an entry past its archive",
      () => bootArchive(buildBig4([["tl1.msh", base.data.length - 1, 2]])),
    ],
  ])("rejects %s", async (_, boot) => {
    const image = iso(boot());
    await expect(readGameGraphics(reader(image), image.length)).rejects.toThrow(
      expect.objectContaining({ message: "Graphics entry is out of range" }),
    );
  });
});
