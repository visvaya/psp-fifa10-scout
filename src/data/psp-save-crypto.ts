// Decryption and hash of PSP savedata in crypt mode 5, the mode FIFA 10 uses.
//
// Port of the save crypto in PPSSPP (Core/HLE/sceChnnlsv.cpp and ext/libkirk/kirk_engine.c,
// Copyright (c) 2012- PPSSPP Project, GPL-2.0-or-later, https://github.com/hrydgard/ppsspp), reduced
// to the steps mode 5 takes: KIRK commands 4 and 7 are AES-128-CBC with a fixed key from the KIRK key
// vault, the body is a counter-mode keystream and the hash is a CMAC-like chain.
import { cbc } from "@noble/ciphers/aes.js";
import { hexToBytes } from "@noble/ciphers/utils.js";
import { SaveFormatError } from "./save-format-error.ts";

const BLOCK_BYTES = 16;
/** sceSdCipherUpdate processes the body in chunks of this size; the counter IV restarts per chunk. */
const CHUNK_BYTES = 2048;

/** KIRK key vault entries used by mode 5 (numFromMode, numFromMode2, typeFromMode in PPSSPP). */
const KIRK_KEY_MAC = hexToBytes("32295bd5eaf7a34216c88e48ff50d371"); // vault[0x10]
const KIRK_KEY_SEED = hexToBytes("5dc71139d01938bc027fdddcb0837d9d"); // vault[0x12]
const KIRK_KEY_STREAM = hexToBytes("03b302e85ff381b13b8daa2a90ff5e61"); // vault[0x64]
/** Mode 5 constants from sceChnnlsv (key19CC, key19DC, hash19BC). */
const SEED_OUT_MASK = hexToBytes("7044a3aeef5da5f2857ff2d694f5363b");
const SEED_IN_MASK = hexToBytes("ec6d29592635a57f972a0dbca3263300");
const HASH_MASK = hexToBytes("cb15f407f96a523c04b9b2ee5c53fa86");
const ZERO_BLOCK = new Uint8Array(BLOCK_BYTES);

const xorBytes = (a: Uint8Array, b: Uint8Array): Uint8Array =>
  a.map((value, index) => value ^ (b[index] ?? 0));

const cbcEncrypt = (key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array =>
  cbc(key, iv, { disablePadding: true }).encrypt(data);

const cbcDecrypt = (key: Uint8Array, iv: Uint8Array, data: Uint8Array): Uint8Array =>
  cbc(key, iv, { disablePadding: true }).decrypt(data);

/** A counter block: the first 12 bytes of the seed and a little-endian 32-bit counter. */
const counterBlock = (seed: Uint8Array, counter: number): Uint8Array => {
  const block = seed.slice(0, BLOCK_BYTES);
  new DataView(block.buffer).setUint32(12, counter >>> 0, true);
  return block;
};

/**
 * XORs `body` with the mode 5 keystream derived from the 16-byte file header and the game key.
 * The keystream is symmetric: the same call encrypts and decrypts.
 */
export const applyKeystream = (
  header: Uint8Array,
  body: Uint8Array,
  gameKey: Uint8Array,
): Uint8Array => {
  const masked = xorBytes(xorBytes(header, gameKey), SEED_IN_MASK);
  const seed = xorBytes(cbcDecrypt(KIRK_KEY_SEED, ZERO_BLOCK, masked), SEED_OUT_MASK);
  const out = new Uint8Array(body.length);
  for (let offset = 0; offset < body.length; offset += CHUNK_BYTES) {
    const chunk = body.subarray(offset, offset + CHUNK_BYTES);
    const first = offset / BLOCK_BYTES + 1;
    const counters = new Uint8Array(chunk.length);
    for (let block = 0; block < chunk.length / BLOCK_BYTES; block += 1) {
      counters.set(counterBlock(seed, first + block), block * BLOCK_BYTES);
    }
    // PPSSPP starts the first chunk from a zero IV and every later one from the previous counter.
    const iv = first === 1 ? ZERO_BLOCK : counterBlock(seed, first - 1);
    out.set(xorBytes(chunk, cbcDecrypt(KIRK_KEY_STREAM, iv, counters)), offset);
  }
  return out;
};

/** Doubling in GF(2^128) as CMAC uses it for its subkey. */
export const doubleBlock = (block: Uint8Array): Uint8Array =>
  block.map((value, index) => {
    const carry = (block[index + 1] ?? 0) >> 7;
    const shifted = ((value << 1) | (index === BLOCK_BYTES - 1 ? 0 : carry)) & 0xff;
    return index === BLOCK_BYTES - 1 && ((block[0] ?? 0) & 0x80) !== 0 ? shifted ^ 0x87 : shifted;
  });

/** The 16-byte hash PARAM.SFO stores for an encrypted file (header and body together). */
export const computeSaveHash = (file: Uint8Array, gameKey: Uint8Array): Uint8Array => {
  const head = file.subarray(0, file.length - BLOCK_BYTES);
  const last = file.subarray(file.length - BLOCK_BYTES);
  // CBC-MAC over everything but the last block. A one-block file gives an empty chain, which
  // xorBytes treats as the zero block, as PPSSPP's zeroed context does.
  const chain = cbcEncrypt(KIRK_KEY_MAC, ZERO_BLOCK, head).slice(-BLOCK_BYTES);
  const subkey = doubleBlock(cbcEncrypt(KIRK_KEY_MAC, ZERO_BLOCK, ZERO_BLOCK));
  const mac = cbcEncrypt(KIRK_KEY_MAC, ZERO_BLOCK, xorBytes(xorBytes(last, subkey), chain));
  return cbcEncrypt(KIRK_KEY_MAC, ZERO_BLOCK, xorBytes(xorBytes(mac, HASH_MASK), gameKey));
};

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Decrypts an encrypted DATA.BIN (16-byte header, then the body) after checking its hash against
 * the one from PARAM.SFO. Throws SaveFormatError when the file is malformed or the hash differs.
 */
export const decryptSaveData = (
  file: Uint8Array,
  gameKey: Uint8Array,
  expectedHash: Uint8Array,
): Uint8Array => {
  if (file.length <= BLOCK_BYTES || file.length % BLOCK_BYTES !== 0) {
    throw new SaveFormatError(
      `Encrypted save has an invalid length (${String(file.length)} bytes)`,
    );
  }
  if (!sameBytes(computeSaveHash(file, gameKey), expectedHash)) {
    throw new SaveFormatError("Save hash does not match PARAM.SFO: wrong game or damaged file");
  }
  return applyKeystream(file.subarray(0, BLOCK_BYTES), file.subarray(BLOCK_BYTES), gameKey);
};
