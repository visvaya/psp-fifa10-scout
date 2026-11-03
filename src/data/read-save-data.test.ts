import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseParamSfo, savedFileHash } from "./param-sfo.ts";
import { applyKeystream, computeSaveHash } from "./psp-save-crypto.ts";
import { FIFA10, readSaveData } from "./read-save-data.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { buildFileList, buildParamSfo, syntheticBytes } from "./test-support/synthetic-save.ts";

const PLAIN = syntheticBytes(2080, 3);

const encryptedSave = (): { dataBin: Uint8Array; paramSfo: Uint8Array } => {
  const header = syntheticBytes(16, 9);
  const dataBin = new Uint8Array(16 + PLAIN.length);
  dataBin.set(header);
  dataBin.set(applyKeystream(header, PLAIN, FIFA10.saveKey), 16);
  const params = new Uint8Array(128);
  params[0] = 0x41;
  const paramSfo = buildParamSfo([
    { key: "SAVEDATA_DIRECTORY", value: "ULES01328081" },
    {
      key: "SAVEDATA_FILE_LIST",
      value: buildFileList("DATA.BIN", computeSaveHash(dataBin, FIFA10.saveKey)),
    },
    { key: "SAVEDATA_PARAMS", value: params },
    { key: "PARENTAL_LEVEL", value: 2 },
  ]);
  return { dataBin, paramSfo };
};

describe("parseParamSfo", () => {
  it("reads text, number and binary entries", () => {
    const sfo = parseParamSfo(encryptedSave().paramSfo);
    expect(sfo.get("SAVEDATA_DIRECTORY")).toBe("ULES01328081");
    expect(sfo.get("PARENTAL_LEVEL")).toBe(2);
    expect(sfo.get("SAVEDATA_PARAMS")).toBeInstanceOf(Uint8Array);
  });

  it("rejects a file without the PSF magic or with an index past its end", () => {
    expect(() => parseParamSfo(new Uint8Array(32))).toThrow(SaveFormatError);
    const truncated = encryptedSave().paramSfo.subarray(0, 40);
    expect(() => parseParamSfo(truncated)).toThrow(/out of range/);
  });

  it("finds the hash of a listed file only", () => {
    const list = buildFileList("DATA.BIN", syntheticBytes(16, 5));
    expect(savedFileHash(list, "DATA.BIN")).toEqual(syntheticBytes(16, 5));
    expect(savedFileHash(list, "OTHER.BIN")).toBeUndefined();
  });
});

describe("readSaveData", () => {
  it("decrypts an encrypted save", () => {
    const { dataBin, paramSfo } = encryptedSave();
    expect(readSaveData(dataBin, paramSfo)).toEqual(PLAIN);
  });

  it("returns an unencrypted save as it is", () => {
    const paramSfo = buildParamSfo([
      { key: "SAVEDATA_FILE_LIST", value: buildFileList("DATA.BIN", new Uint8Array(16)) },
      { key: "SAVEDATA_PARAMS", value: new Uint8Array(128) },
    ]);
    expect(readSaveData(PLAIN, paramSfo)).toEqual(PLAIN);
  });

  it("rejects an unknown encryption mode and a PARAM.SFO of something else", () => {
    const params = new Uint8Array(128);
    params[0] = 0x21;
    const mode3 = buildParamSfo([
      { key: "SAVEDATA_FILE_LIST", value: buildFileList("DATA.BIN", new Uint8Array(16)) },
      { key: "SAVEDATA_PARAMS", value: params },
    ]);
    expect(() => readSaveData(PLAIN, mode3)).toThrow(/Unsupported/);
    expect(() => readSaveData(PLAIN, buildParamSfo([{ key: "TITLE", value: "x" }]))).toThrow(
      /does not describe a save/,
    );
  });
});

// Real saves never enter the repository. Point PSP_SAVE_DIR at a SAVEDATA directory with encrypted
// FIFA 10 saves to check the port against them locally.
const realSaveDir = process.env["PSP_SAVE_DIR"] ?? "";
const realSaves = ["ULES01328001", "ULES01328081"]
  .map((name) => path.join(realSaveDir, name))
  .filter((dir) => realSaveDir !== "" && existsSync(path.join(dir, "PARAM.SFO")));

describe.runIf(realSaves.length > 0)("real saves from PSP_SAVE_DIR", () => {
  it.each(realSaves)("decrypts %s with a matching hash", (dir) => {
    const plain = readSaveData(
      readFileSync(path.join(dir, "DATA.BIN")),
      readFileSync(path.join(dir, "PARAM.SFO")),
    );
    expect(plain.length).toBeGreaterThan(0);
  });
});
