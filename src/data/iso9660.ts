// ISO 9660 disc images (the PSP game ISO PPSSPP runs), read piecewise through an injected range reader so
// a 1.3 GB image never has to be loaded whole. Layout: 2048-byte sectors, primary volume descriptor in
// sector 16 ("CD001", volume size at 80, block size at 128, root directory record at 156), directory
// records (length, extent sector at 2, data length at 10, flags at 25, name length at 32, name at 33)
// that never cross a sector boundary; a zero length byte pads to the next sector.
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
  if (pvd[0] !== 1 || !isIsoVolume(pvd)) throw new SaveFormatError("Not an ISO 9660 disc image");
  if (view.getUint16(128, true) !== SECTOR_BYTES) {
    throw new SaveFormatError("Unsupported ISO 9660 block size");
  }
  return { read, sectors: view.getUint32(80, true), root: readExtent(view, 156) };
};

const readExtentBytes = (volume: Volume, extent: Extent, maxBytes: number): Promise<Uint8Array> => {
  if (extent.size > maxBytes) throw new SaveFormatError("Disc image file is too large");
  if (extent.sector + Math.ceil(extent.size / SECTOR_BYTES) > volume.sectors) {
    throw new SaveFormatError("Disc image extent is out of range");
  }
  return readExactly(volume.read, extent.sector * SECTOR_BYTES, extent.size);
};

/** Strips the ";1" version and the trailing dot of an extensionless name, for a case-insensitive match. */
const normalName = (name: string): string =>
  name.replace(/;\d+$/, "").replace(/\.$/, "").toUpperCase();

const findEntry = (directory: Uint8Array, name: string): Extent | undefined => {
  const view = new DataView(directory.buffer, directory.byteOffset, directory.length);
  const wanted = name.toUpperCase();
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
    if (normalName(entryName) === wanted) return readExtent(view, offset);
    offset += length;
  }
  return undefined;
};

const readVolumeFile = async (
  volume: Volume,
  path: string,
  maxBytes: number,
): Promise<Uint8Array> => {
  const parts = path.split("/").filter((part) => part !== "");
  if (parts.length > MAX_PATH_DEPTH) throw new SaveFormatError("Disc image path is too deep");
  const extent = await parts.reduce(async (parent: Promise<Extent>, part) => {
    const directory = await parent;
    if (!directory.directory) throw new SaveFormatError(`Not found in the disc image: ${path}`);
    const found = findEntry(await readExtentBytes(volume, directory, MAX_DIRECTORY_BYTES), part);
    if (found === undefined) throw new SaveFormatError(`Not found in the disc image: ${path}`);
    return found;
  }, Promise.resolve(volume.root));
  if (extent.directory) throw new SaveFormatError(`Not a file in the disc image: ${path}`);
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
    throw new SaveFormatError(`Disc image is not FIFA 10 ${GAME_ID}: found ${String(discId)}`);
  }
  return readVolumeFile(volume, DATABASE_PATH, MAX_DATABASE_BYTES);
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
      if (fileBytes > MAX_DATABASE_BYTES) throw new SaveFormatError("Database file is too large");
      return readExactly(read, 0, fileBytes);
    }
  }
  throw new SaveFormatError("Not a FIFA 10 disc image or database file");
};
