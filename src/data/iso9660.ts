// ISO 9660 disc images (the PSP game ISO PPSSPP runs), read piecewise through an injected range reader so
// a 1.3 GB image never has to be loaded whole. Layout: 2048-byte sectors, primary volume descriptor in
// sector 16 ("CD001", volume size at 80, block size at 128, root directory record at 156), directory
// records (length, extent sector at 2, data length at 10, flags at 25, name length at 32, name at 33)
// that never cross a sector boundary; a zero length byte pads to the next sector.
import { MAX_IDX_BYTES, MAX_LOC_BYTES } from "./game-locale.ts";
import { parseParamSfo } from "./param-sfo.ts";
import { SaveFormatError } from "./save-format-error.ts";

/** Reads `length` bytes at `offset` of the user's file (a `File` slice in the browser). */
export type ReadRange = (offset: number, length: number) => Promise<Uint8Array>;

const SECTOR_BYTES = 2048;
const PVD_OFFSET = 16 * SECTOR_BYTES;
const RECORD_HEAD_BYTES = 33;
const FLAG_DIRECTORY = 0x02;
const MAX_PATH_DEPTH = 8;
const MAX_DIRECTORY_BYTES = 1024 * 1024;
const MAX_SFO_BYTES = 64 * 1024;
const MAX_DATABASE_BYTES = 16 * 1024 * 1024;
const GAME_ID = "ULES01328";
const SFO_PATH = "PSP_GAME/PARAM.SFO";
const DATABASE_PATH = "PSP_GAME/USRDIR/data/cmn/fifa.db";
const LOCALE_PATH = "PSP_GAME/USRDIR/data/gui/locale";
const DATABASE_HEADER = [0, 0, 0, 0, 4, 0, 0, 0];

interface Extent {
  readonly sector: number;
  readonly size: number;
  readonly directory: boolean;
}

interface Volume {
  readonly read: ReadRange;
  readonly sectors: number;
  readonly root: Extent;
}

const readExactly = async (
  read: ReadRange,
  offset: number,
  length: number,
): Promise<Uint8Array> => {
  const bytes = await read(offset, length);
  if (bytes.length !== length) throw new SaveFormatError("Disc image is truncated");
  return bytes;
};

const isIsoVolume = (bytes: Uint8Array): boolean =>
  new TextDecoder("latin1").decode(bytes.subarray(1, 6)) === "CD001";

const readExtent = (view: DataView, offset: number): Extent => ({
  sector: view.getUint32(offset + 2, true),
  size: view.getUint32(offset + 10, true),
  directory: (view.getUint8(offset + 25) & FLAG_DIRECTORY) !== 0,
});

const openVolume = async (read: ReadRange): Promise<Volume> => {
  const pvd = await readExactly(read, PVD_OFFSET, SECTOR_BYTES);
  const view = new DataView(pvd.buffer, pvd.byteOffset, pvd.length);
  if (pvd[0] !== 1 || !isIsoVolume(pvd))
    throw new SaveFormatError("Not an ISO 9660 disc image", "wrong-file");
  if (view.getUint16(128, true) !== SECTOR_BYTES) {
    throw new SaveFormatError("Unsupported ISO 9660 block size");
  }
  return { read, sectors: view.getUint32(80, true), root: readExtent(view, 156) };
};

const readExtentBytes = (volume: Volume, extent: Extent, maxBytes: number): Promise<Uint8Array> => {
  if (extent.size > maxBytes)
    throw new SaveFormatError("Disc image file is too large", "wrong-file");
  if (extent.sector + Math.ceil(extent.size / SECTOR_BYTES) > volume.sectors) {
    throw new SaveFormatError("Disc image extent is out of range");
  }
  return readExactly(volume.read, extent.sector * SECTOR_BYTES, extent.size);
};

/** Strips the ";1" version and the trailing dot of an extensionless name, for a case-insensitive match. */
const normalName = (name: string): string =>
  name.replace(/;\d+$/, "").replace(/\.$/, "").toUpperCase();

interface Entry extends Extent {
  readonly name: string;
}

/** The records of a directory, names normalised (".", ".." and the version suffix stripped). */
const directoryEntries = (directory: Uint8Array): readonly Entry[] => {
  const view = new DataView(directory.buffer, directory.byteOffset, directory.length);
  const entries: Entry[] = [];
  let offset = 0;
  while (offset < directory.length) {
    const length = directory[offset] ?? 0;
    const sectorEnd = (Math.floor(offset / SECTOR_BYTES) + 1) * SECTOR_BYTES;
    if (length === 0) {
      offset = sectorEnd;
      continue;
    }
    const nameLength = directory[offset + 32] ?? 0;
    if (
      length < RECORD_HEAD_BYTES + nameLength ||
      offset + length > Math.min(sectorEnd, directory.length)
    ) {
      throw new SaveFormatError("Disc image directory record is out of range");
    }
    const start = offset + RECORD_HEAD_BYTES;
    const entryName = new TextDecoder("latin1").decode(
      directory.subarray(start, start + nameLength),
    );
    entries.push({ name: normalName(entryName), ...readExtent(view, offset) });
    offset += length;
  }
  return entries;
};

const findEntry = (directory: Uint8Array, name: string): Extent | undefined =>
  directoryEntries(directory).find((entry) => entry.name === name.toUpperCase());

const notFound = (path: string) => new SaveFormatError(`Not found in the disc image: ${path}`);

const resolvePath = async (volume: Volume, path: string): Promise<Extent> => {
  const parts = path.split("/").filter((part) => part !== "");
  if (parts.length > MAX_PATH_DEPTH) throw new SaveFormatError("Disc image path is too deep");
  return parts.reduce(async (parent: Promise<Extent>, part) => {
    const directory = await parent;
    if (!directory.directory) throw notFound(path);
    const found = findEntry(await readExtentBytes(volume, directory, MAX_DIRECTORY_BYTES), part);
    if (found === undefined) throw notFound(path);
    return found;
  }, Promise.resolve(volume.root));
};

const readVolumeFile = async (
  volume: Volume,
  path: string,
  maxBytes: number,
): Promise<Uint8Array> => {
  const extent = await resolvePath(volume, path);
  if (extent.directory)
    throw new SaveFormatError(`Not a file in the disc image: ${path}`, "wrong-file");
  return readExtentBytes(volume, extent, maxBytes);
};

/** The bytes of one file of an ISO 9660 image. Throws SaveFormatError on a malformed image or missing file. */
export const readIsoFile = async (
  read: ReadRange,
  path: string,
  maxBytes: number,
): Promise<Uint8Array> => readVolumeFile(await openVolume(read), path, maxBytes);

const readDatabaseFromIso = async (read: ReadRange): Promise<Uint8Array> => {
  const volume = await openVolume(read);
  const discId = parseParamSfo(await readVolumeFile(volume, SFO_PATH, MAX_SFO_BYTES)).get(
    "DISC_ID",
  );
  if (discId !== GAME_ID) {
    throw new SaveFormatError(
      `Disc image is not FIFA 10 ${GAME_ID}: found ${String(discId)}`,
      "wrong-game",
    );
  }
  return readVolumeFile(volume, DATABASE_PATH, MAX_DATABASE_BYTES);
};

interface LocaleTables {
  /** The string.idx shared by every language of the directory. */
  readonly idx: Uint8Array;
  /** Each <lang>.loc by its language code (the file name stem), in name order. */
  readonly languages: readonly (readonly [string, Uint8Array])[];
}

export interface IsoLocales extends LocaleTables {
  /** The cgexport subdirectory (the full position names among its texts), or null without one. */
  readonly cgexport: LocaleTables | null;
}

/** The text tables of one locale directory, or null when it is missing or has no index or language. */
const readLocaleTables = async (volume: Volume, path: string): Promise<LocaleTables | null> => {
  const directory = await resolvePath(volume, path).catch((error: unknown) => {
    if (error instanceof SaveFormatError && error.message === notFound(path).message) return null;
    throw error;
  });
  if (directory?.directory !== true) return null;
  const entries = directoryEntries(await readExtentBytes(volume, directory, MAX_DIRECTORY_BYTES));
  const idx = entries.find((entry) => entry.name === "STRING.IDX");
  const locs = entries
    .filter((entry) => !entry.directory && entry.name.endsWith(".LOC"))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  if (idx === undefined || locs.length === 0) return null;
  return {
    idx: await readExtentBytes(volume, idx, MAX_IDX_BYTES),
    languages: await Promise.all(
      locs.map(
        async (entry) =>
          [
            entry.name.slice(0, -".LOC".length).toLowerCase(),
            await readExtentBytes(volume, entry, MAX_LOC_BYTES),
          ] as const,
      ),
    ),
  };
};

/**
 * The main text tables (data/gui/locale) of a disc image with those of its cgexport subdirectory, or
 * null when the file is no disc image or has no such directory (a bare fifa.db). Throws
 * SaveFormatError on a malformed image or file.
 */
export const readIsoLocales = async (
  read: ReadRange,
  fileBytes: number,
): Promise<IsoLocales | null> => {
  if (fileBytes < PVD_OFFSET + SECTOR_BYTES) return null;
  if (!isIsoVolume(await readExactly(read, PVD_OFFSET, 6))) return null;
  const volume = await openVolume(read);
  const main = await readLocaleTables(volume, LOCALE_PATH);
  if (main === null) return null;
  return { ...main, cgexport: await readLocaleTables(volume, `${LOCALE_PATH}/cgexport`) };
};

/**
 * The game database from "the game file" the user picked: the FIFA 10 ISO image or a bare fifa.db,
 * told apart by content. Throws SaveFormatError for anything else.
 */
export const readGameDatabase = async (read: ReadRange, fileBytes: number): Promise<Uint8Array> => {
  if (fileBytes >= PVD_OFFSET + SECTOR_BYTES) {
    if (isIsoVolume(await readExactly(read, PVD_OFFSET, 6))) return readDatabaseFromIso(read);
  }
  if (fileBytes >= DATABASE_HEADER.length) {
    const header = await readExactly(read, 0, DATABASE_HEADER.length);
    if (header.every((byte, index) => byte === DATABASE_HEADER[index])) {
      if (fileBytes > MAX_DATABASE_BYTES)
        throw new SaveFormatError("Database file is too large", "wrong-file");
      return readExactly(read, 0, fileBytes);
    }
  }
  throw new SaveFormatError("Not a FIFA 10 disc image or database file", "wrong-file");
};
