// Synthetic save files for tests. The repository holds no real game data, so tests build their own.

/** Deterministic bytes from a linear congruential generator (glibc constants). */
export const syntheticBytes = (length: number, seed: number): Uint8Array => {
  let state = seed >>> 0;
  return Uint8Array.from({ length }, () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state >>> 24;
  });
};

interface SfoEntry {
  readonly key: string;
  readonly value: string | number | Uint8Array;
}

const UTF8 = 0x0204;
const INT32 = 0x0404;
const BINARY = 0x0004;

const encodeValue = (value: SfoEntry["value"]): { format: number; bytes: Uint8Array } => {
  if (typeof value === "number") {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, true);
    return { format: INT32, bytes };
  }
  if (typeof value === "string") {
    return { format: UTF8, bytes: new TextEncoder().encode(`${value}\0`) };
  }
  return { format: BINARY, bytes: value };
};

/** A minimal PARAM.SFO with the given entries, in the layout the PSP writes. */
export const buildParamSfo = (entries: readonly SfoEntry[]): Uint8Array => {
  const keys = entries.map((entry) => new TextEncoder().encode(`${entry.key}\0`));
  const values = entries.map((entry) => encodeValue(entry.value));
  const keyTable = 20 + entries.length * 16;
  const keyBytes = keys.reduce((sum, key) => sum + key.length, 0);
  const dataTable = keyTable + keyBytes + ((4 - (keyBytes % 4)) % 4);
  const valueBytes = values.reduce((sum, value) => sum + value.bytes.length, 0);
  const out = new Uint8Array(dataTable + valueBytes);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46535000, true);
  view.setUint32(4, 0x0101, true);
  view.setUint32(8, keyTable, true);
  view.setUint32(12, dataTable, true);
  view.setUint32(16, entries.length, true);
  let keyOffset = 0;
  let dataOffset = 0;
  values.forEach((value, index) => {
    const entry = 20 + index * 16;
    const key = keys[index] ?? new Uint8Array();
    view.setUint16(entry, keyOffset, true);
    view.setUint16(entry + 2, value.format, true);
    view.setUint32(entry + 4, value.bytes.length, true);
    view.setUint32(entry + 8, value.bytes.length, true);
    view.setUint32(entry + 12, dataOffset, true);
    out.set(key, keyTable + keyOffset);
    out.set(value.bytes, dataTable + dataOffset);
    keyOffset += key.length;
    dataOffset += value.bytes.length;
  });
  return out;
};

/** A SAVEDATA_FILE_LIST with one entry: name padded to 13 bytes, the hash, 3 bytes of padding. */
export const buildFileList = (fileName: string, hash: Uint8Array): Uint8Array => {
  const entry = new Uint8Array(32);
  entry.set(new TextEncoder().encode(fileName));
  entry.set(hash, 13);
  return entry;
};
