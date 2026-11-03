// FIFA 10 (PSP) text tables (data/gui/locale): <lang>.loc holds the strings of one language in index
// order, string.idx (shared by every language of its directory) maps 32-bit keys to those indices.
// Names of clubs, leagues and countries use key = BASE + digits33(id [+ variant]), where digits33 reads
// the decimal digits as base-33 digits (docs/specs/game-localization.md); fixed labels such as
// position abbreviations use key = labelKey(their English name). Little-endian throughout:
//   .loc       "LOCH", u32 header size, u32 0, u32 section count, u32 section offset; at that offset
//              "LOCL", u32 size, u32 0, u32 N, N x u32 offset from the section start, then UTF-16LE
//              strings, each NUL-terminated.
//   string.idx u32 magic 0x20040519, u32 N, N x (u32 key, u32 string index).
import { SaveFormatError } from "./save-format-error.ts";

export const MAX_LOC_BYTES = 4 * 1024 * 1024;
export const MAX_IDX_BYTES = 1024 * 1024;
const LOCL_HEAD_BYTES = 16;
const IDX_MAGIC = 0x20040519;
const U32 = 2 ** 32;

const TEAM_BASE = 0x7f03b722;
const LEAGUE_BASE = 0xa6800d62;
const COUNTRY_BASE = 0xffe6e6e7;
const LABEL_SEED = 58_175;

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const tagAt = (bytes: Uint8Array, offset: number): string =>
  new TextDecoder("latin1").decode(bytes.subarray(offset, offset + 4));

const checkSize = (bytes: Uint8Array, maxBytes: number, minBytes: number): void => {
  if (bytes.length > maxBytes) throw new SaveFormatError("Locale file is too large");
  if (bytes.length < minBytes) throw new SaveFormatError("Locale file is too short");
};

const readString = (bytes: Uint8Array, start: number): string => {
  const view = viewOf(bytes);
  let end = start;
  // A zero code unit reads zero in either byte order.
  while (end + 1 < bytes.length && view.getUint16(end) !== 0) end += 2;
  if (end + 1 >= bytes.length) throw new SaveFormatError("Locale string is out of range");
  return new TextDecoder("utf-16le").decode(bytes.subarray(start, end));
};

/** The strings of a .loc file in index order. Throws SaveFormatError on a malformed file. */
export const parseLoc = (bytes: Uint8Array): readonly string[] => {
  checkSize(bytes, MAX_LOC_BYTES, 20);
  const view = viewOf(bytes);
  if (tagAt(bytes, 0) !== "LOCH") throw new SaveFormatError("Not a locale file");
  const section = view.getUint32(16, true);
  if (section + LOCL_HEAD_BYTES > bytes.length || tagAt(bytes, section) !== "LOCL") {
    throw new SaveFormatError("Locale file does not describe its strings");
  }
  const count = view.getUint32(section + 12, true);
  const table = section + LOCL_HEAD_BYTES;
  if (table + count * 4 > bytes.length) {
    throw new SaveFormatError("Locale file does not describe its strings");
  }
  return Array.from({ length: count }, (_, index) => {
    const start = section + view.getUint32(table + index * 4, true);
    return readString(bytes, start);
  });
};

/** The (key, string index) pairs of a string.idx file. Throws SaveFormatError on a malformed file. */
export const parseStringIdx = (bytes: Uint8Array): readonly (readonly [number, number])[] => {
  checkSize(bytes, MAX_IDX_BYTES, 8);
  const view = viewOf(bytes);
  if (view.getUint32(0, true) !== IDX_MAGIC) throw new SaveFormatError("Not a string index file");
  const count = view.getUint32(4, true);
  if (8 + count * 8 > bytes.length) {
    throw new SaveFormatError("String index file does not describe its entries");
  }
  return Array.from({ length: count }, (_, index) => [
    view.getUint32(8 + index * 8, true),
    view.getUint32(12 + index * 8, true),
  ]);
};

/** Key -> text of one language, trimmed ("2. Bundesliga\n" is stored with its line break). */
export const readLocale = (loc: Uint8Array, idx: Uint8Array): ReadonlyMap<number, string> => {
  const strings = parseLoc(loc);
  return new Map(
    parseStringIdx(idx).map(([key, index]) => {
      const text = strings[index];
      if (text === undefined) {
        throw new SaveFormatError("String index does not describe this locale file");
      }
      return [key, text.trim()];
    }),
  );
};

const digits33 = (digits: string): number => {
  let value = 0;
  for (let index = 0; index < digits.length; index += 1) {
    value = value * 33 + Number(digits.charAt(index));
  }
  return value;
};

const keyOf = (base: number, digits: string): number => (base + digits33(digits)) % U32;

/** Team name key; variant 0 name, 1 short name, 2 long or alternative name. */
export const teamKey = (teamId: number, variant: 0 | 1 | 2): number =>
  keyOf(TEAM_BASE, `${String(teamId)}${String(variant)}`);

/** League name key; variant 0 name, 1 short name, 2 league group or cup, 3 the league's country. */
export const leagueKey = (leagueId: number, variant: 0 | 1 | 2 | 3): number =>
  keyOf(LEAGUE_BASE, `${String(leagueId)}${String(variant)}`);

export const countryKey = (countryId: number): number => keyOf(COUNTRY_BASE, String(countryId));

/** Key of a fixed label: a multiplier-33 hash of its English name ("GK", "RCDM"). */
export const labelKey = (label: string): number => {
  let key = LABEL_SEED;
  for (let index = 0; index < label.length; index += 1) {
    key = (key * 33 + label.charCodeAt(index)) % U32;
  }
  return key;
};
