// The game's own graphics (club crests, league logos, flags, portraits, kits) from the user's ISO. Two
// archives in data/gui, cro_base.bgb and cro_feonly.bgb, have no header; their entry tables are BIG4
// files: cro_base.bgh is an entry of data/preload/bootpreloaded.big (itself BIG4), cro_feonly.bgh a file
// beside its archive. BIG4: "BIG4", entry count u32 BE at 8, then from 16 per entry offset u32 BE, size
// u32 BE and a NUL-terminated latin1 name. Each entry is a RefPack-packed SHPM file: one 8-bit indexed
// image (type 0x5d, rows padded to 16 bytes, no swizzle) followed by an RGBA palette of up to 256 colours (0x3b).
import { openDiscImage, readVolumeFile } from "./iso9660.ts";
import type { ReadRange, Volume } from "./iso9660.ts";
import { SaveFormatError } from "./save-format-error.ts";

/** bootpreloaded.big is 388 KB and cro_feonly.bgh 64 KB in the game. */
const MAX_TABLE_BYTES = 1024 * 1024;
/** cro_base.bgb is 20.4 MB and cro_feonly.bgb 17.5 MB in the game. */
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
/** Entries of one BIG4 table: the game's hold a few thousand. */
const MAX_TABLE_ENTRIES = 65_536;
/** A packed image: the game's are a few KB. */
const MAX_PACKED_IMAGE_BYTES = 64 * 1024;
/**
 * All packed images kept: about 27 MB in the game. Entries may overlap in a crafted table, so the
 * archive caps alone do not bound it.
 */
const MAX_PACK_BYTES = 48 * 1024 * 1024;
/** An unpacked image: an 85x85 kit is about 9 KB. */
export const MAX_IMAGE_BYTES = 256 * 1024;
const IMAGE_HEAD_BYTES = 16;
const IMAGE_TYPE = 0x5d;
const PALETTE_TYPE = 0x3b;
/** Colours of a palette: an 8-bit index reaches 256. */
const MAX_COLOURS = 256;
const BOOT_PATH = "PSP_GAME/USRDIR/data/preload/bootpreloaded.big";
const GUI_PATH = "PSP_GAME/USRDIR/data/gui";
const BASE_TABLE = "cro_base.bgh";
/**
 * The entries kept: club crests tl<teamid>, league logos ll<leagueid>, real portraits s_<playerid, 8
 * digits> and composed portraits g_<7 digits> in cro_base; flags ls<countryid> and home and away kits
 * j0_ / j1_<teamid, zero-padded to at least 5 digits> in cro_feonly.
 */
const BASE_WANTED = /^(?:tl[0-9]+|ll[0-9]+|s_[0-9]{8}|g_[0-9]{7})[.]msh$/u;
const FEONLY_WANTED = /^(?:ls[0-9]+|j[01]_[0-9]{5,})[.]msh$/u;

interface BigEntry {
  readonly offset: number;
  readonly size: number;
}

/** Packed (still RefPack) images back to back, each by its name without ".msh", offset and length. */
export interface GraphicsPack {
  readonly bytes: Uint8Array;
  readonly entries: readonly (readonly [name: string, offset: number, length: number])[];
}

export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
}

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const latin1 = (bytes: Uint8Array): string => new TextDecoder("latin1").decode(bytes);

/** The entries of a BIG4 table by name. */
export const parseBig4 = (bytes: Uint8Array): ReadonlyMap<string, BigEntry> => {
  if (bytes.length < 16 || latin1(bytes.subarray(0, 4)) !== "BIG4")
    throw new SaveFormatError("Not a BIG4 table");
  const view = viewOf(bytes);
  const count = view.getUint32(8, false);
  if (count > MAX_TABLE_ENTRIES) throw new SaveFormatError("BIG4 table lists too many entries");
  const entries = new Map<string, BigEntry>();
  let at = 16;
  for (let index = count; index > 0; index -= 1) {
    // A head past the end finds no terminator either.
    const end = bytes.indexOf(0, at + 8);
    if (end === -1) throw new SaveFormatError("BIG4 entry is out of range");
    entries.set(latin1(bytes.subarray(at + 8, end)), {
      offset: view.getUint32(at, false),
      size: view.getUint32(at + 4, false),
    });
    at = end + 1;
  }
  return entries;
};

/**
 * A RefPack back-reference command of first byte b0 (below 0xe0) and 1, 2 or 3 more bytes: the literals
 * before it, then how many bytes it copies from how far back.
 */
const backReference = (b0: number, next: () => number) => {
  if (b0 < 0x80) {
    const b1 = next();
    return { before: b0 & 3, count: ((b0 & 0x1c) >> 2) + 3, distance: ((b0 & 0x60) << 3) + b1 + 1 };
  }
  if (b0 < 0xc0) {
    const [b1, b2] = [next(), next()];
    return { before: b1 >> 6, count: (b0 & 0x3f) + 4, distance: ((b1 & 0x3f) << 8) + b2 + 1 };
  }
  const [b1, b2, b3] = [next(), next(), next()];
  return {
    before: b0 & 3,
    count: ((b0 & 0x0c) << 6) + b3 + 5,
    distance: ((b0 & 0x10) << 12) + (b1 << 8) + b2 + 1,
  };
};

/**
 * Unpacks a RefPack stream: flags in byte 0 (bit 0: 3 bytes to skip, bit 7: a 4-byte size), 0xfb, the
 * output size big-endian, then commands of literals and back-references up to a stop code.
 */
export const unrefpack = (packed: Uint8Array, maxBytes: number): Uint8Array => {
  if (packed[1] !== 0xfb) throw new SaveFormatError("Not a RefPack stream");
  let p = 2;
  const next = (): number => {
    const byte = packed[p];
    if (byte === undefined) throw new SaveFormatError("RefPack stream is truncated");
    p += 1;
    return byte;
  };
  const flags = packed[0] ?? 0;
  // Bit 7 makes both the compressed size (skipped) and the output size 4 bytes long.
  const sizeBytes = flags & 0x80 ? 4 : 3;
  p += flags & 0x01 ? sizeBytes : 0;
  let size = 0;
  for (let index = sizeBytes; index > 0; index -= 1) size = size * 256 + next();
  if (size > maxBytes) throw new SaveFormatError("RefPack output is too large");
  const out = new Uint8Array(size);
  let o = 0;
  const literals = (count: number): void => {
    if (p + count > packed.length || o + count > size)
      throw new SaveFormatError("RefPack literals are out of range");
    out.set(packed.subarray(p, p + count), o);
    [p, o] = [p + count, o + count];
  };
  for (;;) {
    const b0 = next();
    if (b0 >= 0xfc) {
      literals(b0 & 3);
      break;
    }
    if (b0 >= 0xe0) {
      literals(((b0 & 0x1f) << 2) + 4);
      continue;
    }
    const { before, count, distance } = backReference(b0, next);
    literals(before);
    if (distance > o || o + count > size)
      throw new SaveFormatError("RefPack back-reference is out of range");
    // Byte by byte: a copy may overlap what it writes.
    for (const end = o + count; o < end; o += 1) out[o] = out[o - distance] ?? 0;
  }
  if (o !== size) throw new SaveFormatError("RefPack output is short");
  return out;
};

/**
 * The 256 colours of the palette block at `palette` as u32, copied byte for byte, so either byte order
 * gives the same RGBA bytes; the colours past its count are transparent.
 */
const readPalette = (bytes: Uint8Array, palette: number): Uint32Array => {
  const view = viewOf(bytes);
  if (palette + IMAGE_HEAD_BYTES > bytes.length || view.getUint8(palette) !== PALETTE_TYPE)
    throw new SaveFormatError("SHPM palette is out of range");
  const paletteBytes = view.getUint32(palette, true) >>> 8;
  const count = view.getUint16(palette + 4, true);
  if (
    count > MAX_COLOURS ||
    IMAGE_HEAD_BYTES + count * 4 > paletteBytes ||
    palette + paletteBytes > bytes.length
  )
    throw new SaveFormatError("SHPM palette is out of range");
  const colours = new Uint32Array(MAX_COLOURS);
  const start = palette + IMAGE_HEAD_BYTES;
  colours.set(new Uint32Array(bytes.slice(start, start + count * 4).buffer));
  return colours;
};

/**
 * The first image of an SHPM file: magic "SHPM", image count u32 LE at 8, directory from 16 (4-byte
 * name, u32 LE offset). Image block: type, 3-byte LE block size (head and pixels), width and height
 * u16 LE at 4 and 6, pixels from 16; the palette block right after it: type, 3-byte LE block size,
 * colour count u16 LE at 4, RGBA colours from 16.
 */
export const decodeShpm = (bytes: Uint8Array): DecodedImage => {
  const view = viewOf(bytes);
  if (bytes.length < 24 || latin1(bytes.subarray(0, 4)) !== "SHPM" || view.getUint32(8, true) < 1)
    throw new SaveFormatError("Not an SHPM image");
  const image = view.getUint32(20, true);
  if (image + IMAGE_HEAD_BYTES > bytes.length)
    throw new SaveFormatError("SHPM image is out of range");
  const type = view.getUint8(image);
  if (type !== IMAGE_TYPE)
    throw new SaveFormatError(`Unsupported SHPM image type 0x${type.toString(16)}`);
  const blockBytes = view.getUint32(image, true) >>> 8;
  const [width, height] = [view.getUint16(image + 4, true), view.getUint16(image + 6, true)];
  const stride = (blockBytes - IMAGE_HEAD_BYTES) / height;
  if (width === 0 || height === 0 || !Number.isInteger(stride) || stride < width)
    throw new SaveFormatError("SHPM image is out of range");
  const colours = readPalette(bytes, image + blockBytes);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const pixels = new Uint32Array(rgba.buffer);
  for (let y = 0; y < height; y += 1) {
    const row = bytes.subarray(image + IMAGE_HEAD_BYTES + y * stride);
    for (let x = 0; x < width; x += 1) pixels[y * width + x] = colours[row[x] ?? 0] ?? 0;
  }
  return { width, height, rgba };
};

const entryBytes = (archive: Uint8Array, { offset, size }: BigEntry): Uint8Array => {
  if (offset + size > archive.length) throw new SaveFormatError("Graphics entry is out of range");
  return archive.subarray(offset, offset + size);
};

/** A table's entries whose names match, each checked against the cap of a packed image. */
const wantedOf = (table: ReadonlyMap<string, BigEntry>, wanted: RegExp) =>
  [...table]
    .filter(([name]) => wanted.test(name))
    .map(([name, entry]) => {
      if (entry.size > MAX_PACKED_IMAGE_BYTES)
        throw new SaveFormatError("Graphics entry is too large");
      return [name, entry] as const;
    });

/**
 * The packed images of a disc image's graphics archives. Each archive is read with one read and only
 * the wanted entries are copied out, so the archive's buffer can be freed.
 */
const readPack = async (
  volume: Volume,
  stillWanted: () => boolean,
): Promise<GraphicsPack | null> => {
  const boot = await readVolumeFile(volume, BOOT_PATH, MAX_TABLE_BYTES);
  const baseTable = parseBig4(boot).get(BASE_TABLE);
  if (baseTable === undefined) throw new SaveFormatError("Disc image has no graphics table");
  const sources = [
    {
      path: `${GUI_PATH}/cro_base.bgb`,
      entries: wantedOf(parseBig4(entryBytes(boot, baseTable)), BASE_WANTED),
    },
    {
      path: `${GUI_PATH}/cro_feonly.bgb`,
      entries: wantedOf(
        parseBig4(await readVolumeFile(volume, `${GUI_PATH}/cro_feonly.bgh`, MAX_TABLE_BYTES)),
        FEONLY_WANTED,
      ),
    },
  ];
  // Checked before any archive is read.
  const packBytes = sources
    .flatMap(({ entries }) => entries)
    .reduce((sum, [, { size }]) => sum + size, 0);
  if (packBytes > MAX_PACK_BYTES) throw new SaveFormatError("Graphics are too large");
  const bytes = new Uint8Array(packBytes);
  const entries: (readonly [string, number, number])[] = [];
  let offset = 0;
  // One archive after the other, so only one is in memory at a time; none once the load is superseded.
  const complete = await sources.reduce(async (before: Promise<boolean>, source) => {
    if (!(await before) || !stillWanted()) return false;
    const archive = await readVolumeFile(volume, source.path, MAX_ARCHIVE_BYTES);
    for (const [name, entry] of source.entries) {
      bytes.set(entryBytes(archive, entry), offset);
      entries.push([name.slice(0, -".msh".length), offset, entry.size]);
      offset += entry.size;
    }
    return true;
  }, Promise.resolve(true));
  return complete ? { bytes, entries } : null;
};

/**
 * The game's graphics, or null when the file is no disc image (a bare fifa.db) or stillWanted says no
 * before an archive is read. Throws SaveFormatError on a malformed image, table or entry.
 */
export const readGameGraphics = async (
  read: ReadRange,
  fileBytes: number,
  stillWanted: () => boolean,
): Promise<GraphicsPack | null> => {
  const volume = await openDiscImage(read, fileBytes);
  return volume === null ? null : readPack(volume, stillWanted);
};
