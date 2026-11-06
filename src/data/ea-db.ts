// FIFA 10 (PSP) database files (fifa.db): header, table directory, one block of fixed-size records
// per table, then a pool of length-prefixed UTF-8 strings. All offsets are absolute file offsets.
import { SaveFormatError } from "./save-format-error.ts";

const HEADER_BYTES = 12;
const ENTRY_HEAD_BYTES = 28;
const BLOCK_HEAD_BYTES = 8;
const BIRTHDATE_EPOCH_MS = Date.UTC(1582, 9, 14);
const DAY_MS = 86_400_000;

interface WordField {
  readonly name: string;
  /** u32: ids and keys; raw32: opaque 4-byte value, read as a number but not interpreted; string. */
  readonly kind: "u32" | "raw32" | "string";
  readonly bits: 32;
  /** Bit offset from the start of the record. */
  readonly bitOffset: number;
}

interface BitField {
  readonly name: string;
  /** Value = lo + stored bits, MSB first; a 32-bit field is a little-endian word instead. */
  readonly kind: "bits";
  readonly bits: number;
  readonly bitOffset: number;
  readonly lo: number;
  readonly hi: number;
}

type EaDbField = WordField | BitField;

export interface EaDbTable {
  readonly name: string;
  /** Offset of the table's directory entry. */
  readonly directoryOffset: number;
  readonly rowCount: number;
  readonly recordSize: number;
  readonly fields: readonly EaDbField[];
  /** Offset of the first record. */
  readonly recordsOffset: number;
}

export interface EaDb {
  readonly view: DataView;
  readonly tables: ReadonlyMap<string, EaDbTable>;
}

export type EaDbRow = Readonly<Record<string, number | string>>;

const utf8 = new TextDecoder();

const u32 = (view: DataView, offset: number): number => {
  if (offset + 4 > view.byteLength) throw new SaveFormatError("Database offset is out of range");
  return view.getUint32(offset, true);
};

export const readString = (view: DataView, offset: number): string => {
  if (offset + 2 > view.byteLength) throw new SaveFormatError("Database offset is out of range");
  const start = offset + 2;
  const end = start + view.getUint16(offset, true);
  if (end > view.byteLength) throw new SaveFormatError("Database string is out of range");
  return utf8.decode(new Uint8Array(view.buffer, view.byteOffset + start, end - start));
};

const bitWidth = (lo: number, hi: number): number => Math.max(1, 32 - Math.clz32((hi - lo) >>> 0));

const bitFields = (
  view: DataView,
  rangesOffset: number,
  names: readonly string[],
  startBit: number,
): readonly BitField[] => {
  let bitOffset = startBit;
  return names.map((name, index) => {
    const lo = view.getInt32(rangesOffset + 8 * index, true);
    const hi = view.getInt32(rangesOffset + 8 * index + 4, true);
    const field = { name, kind: "bits", bits: bitWidth(lo, hi), bitOffset, lo, hi } as const;
    if (field.bits === 32 && bitOffset % 8 !== 0) {
      throw new SaveFormatError(`Database field ${name} is not byte aligned`);
    }
    bitOffset += field.bits;
    return field;
  });
};

/** The directory entry at `offset` and the offset after it. */
const parseEntry = (
  view: DataView,
  offset: number,
): { entry: Omit<EaDbTable, "rowCount" | "recordsOffset" | "directoryOffset">; end: number } => {
  const word = (index: number): number => u32(view, offset + 4 * index);
  const name = readString(view, word(0));
  const recordSize = word(2);
  const [ints, raws, strings, bits] = [word(3), word(4), word(5), word(6)];
  const fixed = ints + raws + strings;
  const rangesOffset = offset + ENTRY_HEAD_BYTES;
  const namesOffset = rangesOffset + 8 * bits;
  const end = namesOffset + 4 * (fixed + bits);
  if (end > view.byteLength) throw new SaveFormatError(`Database entry ${name} is out of range`);
  const names = Array.from({ length: fixed + bits }, (_, index) =>
    readString(view, view.getUint32(namesOffset + 4 * index, true)),
  );
  const words = names.slice(0, fixed).map((fieldName, index): WordField => ({
    name: fieldName,
    kind: index < ints ? "u32" : index < ints + raws ? "raw32" : "string",
    bits: 32,
    bitOffset: 32 * index,
  }));
  const packed = bitFields(view, rangesOffset, names.slice(fixed), 32 * fixed);
  const bitTotal = packed.reduce((total, field) => total + field.bits, 0);
  if (4 * fixed + 4 * Math.ceil(bitTotal / 32) !== recordSize) {
    throw new SaveFormatError(`Database record size of ${name} does not match its fields`);
  }
  return { entry: { name, recordSize, fields: [...words, ...packed] }, end };
};

/** The table catalogue of a database file. Throws SaveFormatError on a malformed file. */
export const parseEaDb = (bytes: Uint8Array): EaDb => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  if (bytes.length < HEADER_BYTES)
    throw new SaveFormatError("Database file is too short", "wrong-file");
  const count = view.getUint32(8, true);
  const directory = HEADER_BYTES + 4 * (count + 1);
  if (directory > bytes.length) throw new SaveFormatError("Database table list is out of range");
  const lookup = view.getUint32(12, true);
  if (lookup > bytes.length) throw new SaveFormatError("Database directory is out of range");
  const entries = new Map<number, ReturnType<typeof parseEntry>["entry"]>();
  let offset = directory;
  while (offset < lookup) {
    const { entry, end } = parseEntry(view, offset);
    entries.set(offset, entry);
    offset = end;
  }
  if (offset !== lookup || entries.size !== count) {
    throw new SaveFormatError("Database directory does not match its table count");
  }
  const tables = Array.from({ length: count }, (_, index): EaDbTable => {
    const block = view.getUint32(HEADER_BYTES + 4 + 4 * index, true);
    const entry = entries.get(u32(view, block + 4));
    if (entry === undefined) throw new SaveFormatError("Database data block points to no table");
    const rowCount = u32(view, block);
    const recordsOffset = block + BLOCK_HEAD_BYTES;
    if (recordsOffset + rowCount * entry.recordSize > bytes.length) {
      throw new SaveFormatError(`Database rows of ${entry.name} are out of range`);
    }
    return { ...entry, directoryOffset: u32(view, block + 4), rowCount, recordsOffset };
  });
  return { view, tables: new Map(tables.map((table) => [table.name, table])) };
};

type FieldReader = (record: number) => number | string;

const bitReader = (view: DataView, field: BitField): FieldReader => {
  if (field.bits === 32) return (record) => view.getUint32(record + field.bitOffset / 8, true);
  // A field of up to 31 bits spans at most 5 bytes: read them as one number, then cut the field out.
  const skipped = field.bitOffset & 7;
  const span = (skipped + field.bits + 7) >>> 3;
  const divisor = 2 ** (8 * span - skipped - field.bits);
  const modulus = 2 ** field.bits;
  return (record) => {
    const first = record + (field.bitOffset >>> 3);
    let window = 0;
    for (let index = 0; index < span; index += 1) {
      window = window * 256 + view.getUint8(first + index);
    }
    return field.lo + (Math.floor(window / divisor) % modulus);
  };
};

const fieldReader = (
  view: DataView,
  field: EaDbField,
  stringAt: (ref: number) => string,
): FieldReader => {
  if (field.kind === "bits") return bitReader(view, field);
  const byteOffset = field.bitOffset / 8;
  if (field.kind === "string")
    return (record) => stringAt(view.getUint32(record + byteOffset, true));
  return (record) => view.getUint32(record + byteOffset, true);
};

/** Every row of a table as a frozen object keyed by field name. */
export const readTable = (db: EaDb, name: string): readonly EaDbRow[] => {
  const table = db.tables.get(name);
  if (table === undefined) throw new SaveFormatError(`Database has no table "${name}"`);
  return readRecords(db.view, table, (ref) => readString(db.view, ref));
};

/**
 * The records of `table` (`rowCount` from `recordsOffset`) in `view`, which the caller has
 * bounds-checked; `stringAt` resolves the value of a string field.
 */
export const readRecords = (
  view: DataView,
  table: EaDbTable,
  stringAt: (ref: number) => string,
): readonly EaDbRow[] => {
  const readers = table.fields.map(
    (field) => [field.name, fieldReader(view, field, stringAt)] as const,
  );
  return Array.from({ length: table.rowCount }, (_, row) => {
    const record = table.recordsOffset + row * table.recordSize;
    return Object.freeze(Object.fromEntries(readers.map(([key, read]) => [key, read(record)])));
  });
};

/** A birthdate field (days since 1582-10-14) as a UTC date. */
export const birthdateToDate = (days: number): Date => new Date(BIRTHDATE_EPOCH_MS + days * DAY_MS);

/** Full years between two UTC dates. */
export const ageOn = (birth: Date, on: Date): number => {
  const years = on.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - birth.getUTCMonth();
  const beforeBirthday = monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < birth.getUTCDate());
  return beforeBirthday ? years - 1 : years;
};
