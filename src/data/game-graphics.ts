// The game's own graphics (club crests, league logos, flags, portraits, kits) from the user's ISO. Two
// archives in data/gui, cro_base.bgb and cro_feonly.bgb, have no header; their entry tables are BIG4
// files: cro_base.bgh is an entry of data/preload/bootpreloaded.big (itself BIG4), cro_feonly.bgh a file
// beside its archive. BIG4: "BIG4", entry count u32 BE at 8, then from 16 per entry offset u32 BE, size
// u32 BE and a NUL-terminated latin1 name. Each entry is a RefPack-packed SHPM file: one 8-bit indexed
// image (type 0x5d, rows padded to 16 bytes, no swizzle) followed by a 256-colour RGBA palette (0x3b).
import { openDiscImage, readVolumeFile } from "./iso9660.ts";
import type { ReadRange } from "./iso9660.ts";
import { SaveFormatError } from "./save-format-error.ts";

/** bootpreloaded.big is 388 KB and cro_feonly.bgh 64 KB in the game. */
const MAX_TABLE_BYTES = 1024 * 1024;
/** cro_base.bgb is 20.4 MB and cro_feonly.bgb 17.5 MB in the game. */
const MAX_ARCHIVE_BYTES = 32 * 1024 * 1024;
/** An unpacked image: an 85x85 kit is about 9 KB. */
export const MAX_IMAGE_BYTES = 256 * 1024;
const IMAGE_HEAD_BYTES = 16;
const IMAGE_TYPE = 0x5d;
const PALETTE_TYPE = 0x3b;
const PALETTE_BYTES = 256 * 4;
const BOOT_PATH = "PSP_GAME/USRDIR/data/preload/bootpreloaded.big";
const GUI_PATH = "PSP_GAME/USRDIR/data/gui";
const BASE_TABLE = "cro_base.bgh";
/**
 * The entries kept: club crests tl<teamid>, league logos ll<leagueid>, real portraits s_<playerid, 8
 * digits> and composed portraits g_<7 digits> in cro_base; flags ls<countryid> and home and away kits
 * j0_ / j1_<teamid, 5 digits> in cro_feonly.
 */
const BASE_WANTED = /^(?:tl[0-9]+|ll[0-9]+|s_[0-9]{8}|g_[0-9]{7})[.]msh$/u;
const FEONLY_WANTED = /^(?:ls[0-9]+|j[01]_[0-9]{5})[.]msh$/u;

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
  readonly rgba: Uint8ClampedArray;
}

const viewOf = (bytes: Uint8Array): DataView =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const latin1 = (bytes: Uint8Array): string => new TextDecoder("latin1").decode(bytes);

/** The entries of a BIG4 table by name. */
export const parseBig4 = (bytes: Uint8Array): ReadonlyMap<string, BigEntry> => {
  if (bytes.length < 16 || latin1(bytes.subarray(0, 4)) !== "BIG4")
    throw new SaveFormatError("Not a BIG4 table");
  const view = viewOf(bytes);
  const entries = new Map<string, BigEntry>();
  let at = 16;
  for (let index = view.getUint32(8, false); index > 0; index -= 1) {
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
  p += flags & 0x01 ? 3 : 0;
  let size = 0;
  for (let index = flags & 0x80 ? 4 : 3; index > 0; index -= 1) size = size * 256 + next();
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
 * The first image of an SHPM file: magic "SHPM", image count u32 LE at 8, directory from 16 (4-byte
 * name, u32 LE offset). Image block: type, 3-byte LE block size (head and pixels), width and height
 * u16 LE at 4 and 6, pixels from 16; the palette block right after it, its colours from 16.
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
  const palette = image + blockBytes;
  if (palette + 16 + PALETTE_BYTES > bytes.length || view.getUint8(palette) !== PALETTE_TYPE)
    throw new SaveFormatError("SHPM palette is out of range");
  const colours = bytes.subarray(palette + 16, palette + 16 + PALETTE_BYTES);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const start = image + IMAGE_HEAD_BYTES + y * stride;
    for (const [x, index] of bytes.subarray(start, start + width).entries())
      rgba.set(colours.subarray(index * 4, index * 4 + 4), (y * width + x) * 4);
  }
  return { width, height, rgba };
};

const entryBytes = (archive: Uint8Array, { offset, size }: BigEntry): Uint8Array => {
  if (offset + size > archive.length) throw new SaveFormatError("Graphics entry is out of range");
  return archive.subarray(offset, offset + size);
};

/**
 * The packed images of the disc image's graphics archives, or null when the file is no disc image (a
 * bare fifa.db). Each archive is read with one read and only the wanted entries are copied out, so the
 * archive's buffer can be freed. Throws SaveFormatError on a malformed image, table or entry.
 */
export const readGameGraphics = async (
  read: ReadRange,
  fileBytes: number,
): Promise<GraphicsPack | null> => {
  const volume = await openDiscImage(read, fileBytes);
  if (volume === null) return null;
  const boot = await readVolumeFile(volume, BOOT_PATH, MAX_TABLE_BYTES);
  const baseTable = parseBig4(boot).get(BASE_TABLE);
  if (baseTable === undefined) throw new SaveFormatError("Disc image has no graphics table");
  const sources = [
    {
      path: `${GUI_PATH}/cro_base.bgb`,
      wanted: BASE_WANTED,
      table: parseBig4(entryBytes(boot, baseTable)),
    },
    {
      path: `${GUI_PATH}/cro_feonly.bgb`,
      wanted: FEONLY_WANTED,
      table: parseBig4(await readVolumeFile(volume, `${GUI_PATH}/cro_feonly.bgh`, MAX_TABLE_BYTES)),
    },
  ];
  // One archive after the other, so only one is in memory at a time.
  const kept = await sources.reduce<Promise<readonly (readonly [string, Uint8Array])[]>>(
    async (done, { path, wanted, table }) => {
      const before = await done;
      const archive = await readVolumeFile(volume, path, MAX_ARCHIVE_BYTES);
      return [
        ...before,
        ...[...table]
          .filter(([name]) => wanted.test(name))
          .map(
            ([name, entry]) =>
              [name.slice(0, -".msh".length), entryBytes(archive, entry).slice()] as const,
          ),
      ];
    },
    Promise.resolve([]),
  );
  const bytes = new Uint8Array(kept.reduce((sum, [, packed]) => sum + packed.length, 0));
  let offset = 0;
  const entries = kept.map(([name, packed]) => {
    bytes.set(packed, offset);
    offset += packed.length;
    return [name, offset - packed.length, packed.length] as const;
  });
  return { bytes, entries };
};
