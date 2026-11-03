import { createHash } from "node:crypto";
import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";
import { describe, expect, it } from "vitest";
import { applyKeystream, computeSaveHash, decryptSaveData } from "./psp-save-crypto.ts";
import { SaveFormatError } from "./save-format-error.ts";
import { syntheticBytes } from "./test-support/synthetic-save.ts";

const GAME_KEY = hexToBytes("f0c7f22683e651c8cec54e343241504b");

// Known answer from an independent implementation (Node crypto) that reproduced the hashes stored in
// real FIFA 10 saves before this port existed. The body spans three 2048-byte chunks, so the counter
// carries over chunk boundaries.
const KNOWN = {
  header: "cc262a587f8d7d7c1faa2be373e58201",
  fileSha256: "9b5e40a4c90ad58f958befb3d080f71dc10b708050ee5cf4a4c2dcd201d72aa4",
  hash: "ee9c7d62998b2784d7e53f55a504d22c",
};

const encrypt = (header: Uint8Array, plain: Uint8Array): Uint8Array => {
  const file = new Uint8Array(header.length + plain.length);
  file.set(header);
  file.set(applyKeystream(header, plain, GAME_KEY), header.length);
  return file;
};

describe("save crypto, mode 5", () => {
  const header = syntheticBytes(16, 7);
  const plain = syntheticBytes(4112, 42);
  const file = encrypt(header, plain);

  it("matches the known-answer vector", () => {
    expect(bytesToHex(header)).toBe(KNOWN.header);
    expect(createHash("sha256").update(file).digest("hex")).toBe(KNOWN.fileSha256);
    expect(bytesToHex(computeSaveHash(file, GAME_KEY))).toBe(KNOWN.hash);
  });

  it("decrypts what it encrypted when the hash matches", () => {
    expect(decryptSaveData(file, GAME_KEY, hexToBytes(KNOWN.hash))).toEqual(plain);
  });

  it("rejects a file changed after hashing", () => {
    const damaged = file.slice();
    damaged[100] = (damaged[100] ?? 0) ^ 1;
    expect(() => decryptSaveData(damaged, GAME_KEY, hexToBytes(KNOWN.hash))).toThrow(
      SaveFormatError,
    );
  });

  it("rejects another game's key", () => {
    const otherKey = syntheticBytes(16, 1);
    expect(() => decryptSaveData(file, otherKey, hexToBytes(KNOWN.hash))).toThrow(/hash/);
  });

  it("rejects lengths that are not whole blocks or hold no body", () => {
    expect(() => decryptSaveData(file.subarray(0, 40), GAME_KEY, new Uint8Array(16))).toThrow(
      /length/,
    );
    expect(() => decryptSaveData(file.subarray(0, 16), GAME_KEY, new Uint8Array(16))).toThrow(
      /length/,
    );
  });
});
