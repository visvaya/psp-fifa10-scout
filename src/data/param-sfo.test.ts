import { describe, expect, it } from "vitest";
import { parseParamSfo, savedFileHash } from "./param-sfo.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildFileList, buildParamSfo, syntheticBytes } from "./test-support/synthetic-save.ts";

const SAMPLE = buildParamSfo([
  { key: "SAVEDATA_DIRECTORY", value: "ULES01328081" },
  { key: "SAVEDATA_PARAMS", value: new Uint8Array([0x41, 0, 0, 0]) },
  { key: "PARENTAL_LEVEL", value: 2 },
]);

/** Copy of SAMPLE with one little-endian u32 or u16 changed. */
const patched = (offset: number, value: number, bytes: 2 | 4 = 4): Uint8Array => {
  const copy = SAMPLE.slice();
  const view = new DataView(copy.buffer);
  if (bytes === 4) view.setUint32(offset, value, true);
  else view.setUint16(offset, value, true);
  return copy;
};

// Entry layout: index entries start at byte 20, 16 bytes each (key offset u16, format u16,
// length u32, max length u32, data offset u32).
const ENTRY = (index: number): number => 20 + index * 16;

describe("parseParamSfo", () => {
  it("reads text, number and binary entries", () => {
    const sfo = parseParamSfo(SAMPLE);
    expect(sfo.get("SAVEDATA_DIRECTORY")).toBe("ULES01328081");
    expect(sfo.get("PARENTAL_LEVEL")).toBe(2);
    expect(sfo.get("SAVEDATA_PARAMS")).toEqual(new Uint8Array([0x41, 0, 0, 0]));
  });

  it("reads a text value that has no terminating zero", () => {
    // Shorten the stored length of SAVEDATA_DIRECTORY so its zero byte falls outside the value.
    expect(parseParamSfo(patched(ENTRY(0) + 4, 4)).get("SAVEDATA_DIRECTORY")).toBe("ULES");
  });

  it("reads a text value that starts with its terminating zero as empty", () => {
    const sfo = parseParamSfo(buildParamSfo([{ key: "SAVEDATA_TITLE", value: "\0ignored" }]));
    expect(sfo.get("SAVEDATA_TITLE")).toBe("");
  });

  it("keeps a number entry whose length is not 4 as raw bytes", () => {
    const value = parseParamSfo(patched(ENTRY(2) + 4, 2)).get("PARENTAL_LEVEL");
    expect(value).toEqual(new Uint8Array([2, 0]));
  });

  it("treats a 4-byte binary entry as bytes, not as a number", () => {
    expect(parseParamSfo(SAMPLE).get("SAVEDATA_PARAMS")).toBeInstanceOf(Uint8Array);
  });

  it("bounds the decoded keys and values to the file size", () => {
    const entries = Array.from({ length: 20 }, (_, index) => ({
      key: `K${String(index)}`,
      value: "x".repeat(200),
    }));
    const bytes = buildParamSfo(entries);
    expect(parseParamSfo(bytes).size).toBe(20);
    // Every entry's value now covers all twenty values.
    const view = new DataView(bytes.buffer);
    entries.forEach((_, index) => {
      view.setUint32(ENTRY(index) + 4, 20 * 201, true);
      view.setUint32(ENTRY(index) + 12, 0, true);
    });
    expect(() => parseParamSfo(bytes)).toThrow("PARAM.SFO entries overlap");
  });

  it("rejects files that are too short or lack the PSF magic", () => {
    expect(() => parseParamSfo(new Uint8Array(19))).toThrow(/too short/);
    expect(() => parseParamSfo(new Uint8Array(20))).toThrow(
      expect.objectContaining({
        message: "Not a PARAM.SFO file",
        kind: "wrong-file",
      }),
    );
  });

  it("accepts an index that ends exactly at the end of the file", () => {
    const header = SAMPLE.slice(0, 20);
    new DataView(header.buffer).setUint32(16, 0, true);
    expect(parseParamSfo(header).size).toBe(0);
  });

  it("rejects an index past the end of the file", () => {
    expect(() => parseParamSfo(SAMPLE.subarray(0, 40))).toThrow(/index is out of range/);
  });

  it("rejects a value past the end of the file", () => {
    expect(() => parseParamSfo(patched(ENTRY(0) + 4, 4096))).toThrow(/value is out of range/);
  });

  it("rejects a key that is not terminated", () => {
    expect(() => parseParamSfo(patched(ENTRY(0), 0xfff0, 2))).toThrow(/not terminated/);
    expect(() => parseParamSfo(patched(ENTRY(0), 0xfff0, 2))).toThrow(SaveFormatError);
  });
});

describe("savedFileHash", () => {
  const hash = syntheticBytes(16, 5);

  it("finds the hash of a listed file only", () => {
    const list = buildFileList("DATA.BIN", hash);
    expect(savedFileHash(list, "DATA.BIN")).toEqual(hash);
    expect(savedFileHash(list, "OTHER.BIN")).toBeUndefined();
  });

  it("finds a later entry and a name that fills all 13 bytes", () => {
    const list = new Uint8Array(64);
    list.set(buildFileList("ICON0.PNG", syntheticBytes(16, 1)));
    list.set(buildFileList("ABCDEFGHI.BIN", hash), 32);
    expect(savedFileHash(list, "ABCDEFGHI.BIN")).toEqual(hash);
  });

  it("ignores a trailing entry that is cut short", () => {
    const list = buildFileList("DATA.BIN", hash).subarray(0, 31);
    expect(savedFileHash(list, "DATA.BIN")).toBeUndefined();
  });
});
