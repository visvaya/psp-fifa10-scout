import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

const withParams = (flag: number, fileList: Uint8Array): Uint8Array => {
  const params = new Uint8Array(128);
  params[0] = flag;
  return buildParamSfo([
    { key: "SAVEDATA_FILE_LIST", value: fileList },
    { key: "SAVEDATA_PARAMS", value: params },
  ]);
};

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

  it("names the unsupported encryption flag", () => {
    const mode3 = withParams(0x21, buildFileList("DATA.BIN", new Uint8Array(16)));
    expect(() => readSaveData(PLAIN, mode3)).toThrow(/Unsupported save encryption \(flag 0x21\)/);
  });

  it("rejects a PARAM.SFO without the save entries, even with one of them present", () => {
    const fileListOnly = buildParamSfo([
      { key: "SAVEDATA_FILE_LIST", value: buildFileList("DATA.BIN", new Uint8Array(16)) },
    ]);
    const paramsOnly = buildParamSfo([{ key: "SAVEDATA_PARAMS", value: new Uint8Array(128) }]);
    for (const sfo of [fileListOnly, paramsOnly, buildParamSfo([{ key: "TITLE", value: "x" }])]) {
      expect(() => readSaveData(PLAIN, sfo)).toThrow(
        expect.objectContaining({
          message: "PARAM.SFO does not describe a save",
          kind: "wrong-file",
        }),
      );
    }
  });

  it("rejects an encrypted save whose PARAM.SFO does not list DATA.BIN", () => {
    const sfo = withParams(0x41, buildFileList("OTHER.BIN", new Uint8Array(16)));
    expect(() => readSaveData(encryptedSave().dataBin, sfo)).toThrow(
      expect.objectContaining({
        message: "PARAM.SFO lists no DATA.BIN",
        kind: "wrong-file",
      }),
    );
    expect(() => readSaveData(encryptedSave().dataBin, sfo)).toThrow(SaveFormatError);
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
