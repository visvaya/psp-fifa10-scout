// PARAM.SFO, the key-value file next to every PSP save.
// Layout: header (magic "\0PSF", version, key table offset, data table offset, entry count), then
// 16-byte index entries (key offset u16, format u16, length u32, max length u32, data offset u32).
import { SaveFormatError } from "./save-format-error.ts";

/** Real PARAM.SFO files of the game and its saves are about 5 KB. */
export const MAX_SFO_BYTES = 64 * 1024;
const MAGIC = 0x46535000; // "\0PSF" read as a little-endian u32
const HEADER_BYTES = 20;
const ENTRY_BYTES = 16;
const FORMAT_UTF8 = 0x0204;
const FORMAT_INT32 = 0x0404;

export type SfoValue = string | number | Uint8Array;

const readCString = (bytes: Uint8Array, start: number): string => {
  const end = bytes.indexOf(0, start);
  if (end < 0) throw new SaveFormatError("PARAM.SFO key is not terminated");
  return new TextDecoder("latin1").decode(bytes.subarray(start, end));
};

const readValue = (bytes: Uint8Array, format: number, start: number, length: number): SfoValue => {
  if (start + length > bytes.length) throw new SaveFormatError("PARAM.SFO value is out of range");
  const raw = bytes.subarray(start, start + length);
  if (format === FORMAT_INT32 && length === 4) {
    return new DataView(raw.buffer, raw.byteOffset, 4).getUint32(0, true);
  }
  if (format === FORMAT_UTF8) {
    const end = raw.indexOf(0);
    return new TextDecoder().decode(end < 0 ? raw : raw.subarray(0, end));
  }
  return raw;
};

/** Every entry of a PARAM.SFO by key. Throws SaveFormatError on a malformed file. */
export const parseParamSfo = (bytes: Uint8Array): ReadonlyMap<string, SfoValue> => {
  if (bytes.length < HEADER_BYTES)
    throw new SaveFormatError("PARAM.SFO is too short", "wrong-file");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  if (view.getUint32(0, true) !== MAGIC)
    throw new SaveFormatError("Not a PARAM.SFO file", "wrong-file");
  const keyTable = view.getUint32(8, true);
  const dataTable = view.getUint32(12, true);
  const count = view.getUint32(16, true);
  if (HEADER_BYTES + count * ENTRY_BYTES > bytes.length) {
    throw new SaveFormatError("PARAM.SFO index is out of range");
  }
  return new Map(
    Array.from({ length: count }, (_, index) => {
      const entry = HEADER_BYTES + index * ENTRY_BYTES;
      const key = readCString(bytes, keyTable + view.getUint16(entry, true));
      const format = view.getUint16(entry + 2, true);
      const length = view.getUint32(entry + 4, true);
      const start = dataTable + view.getUint32(entry + 12, true);
      return [key, readValue(bytes, format, start, length)] as const;
    }),
  );
};

/** SAVEDATA_FILE_LIST entries: name (13 bytes), hash (16 bytes), padding (3 bytes). */
const FILE_LIST_ENTRY_BYTES = 32;
const FILE_NAME_BYTES = 13;
const FILE_HASH_BYTES = 16;

/** The hash PARAM.SFO records for one file of the save, or undefined when the file is not listed. */
export const savedFileHash = (fileList: Uint8Array, fileName: string): Uint8Array | undefined => {
  for (
    let entry = 0;
    entry + FILE_LIST_ENTRY_BYTES <= fileList.length;
    entry += FILE_LIST_ENTRY_BYTES
  ) {
    const nameBytes = fileList.subarray(entry, entry + FILE_NAME_BYTES);
    const end = nameBytes.indexOf(0);
    const name = new TextDecoder("latin1").decode(end < 0 ? nameBytes : nameBytes.subarray(0, end));
    if (name === fileName) {
      const hashStart = entry + FILE_NAME_BYTES;
      return fileList.slice(hashStart, hashStart + FILE_HASH_BYTES);
    }
  }
  return undefined;
};
