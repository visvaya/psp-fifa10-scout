// Synthetic FIFA 10 databases for tests. The builder lays out header, directory, data blocks and the
// string pool, but takes each record's bit area as hand-written bytes, so it does not repeat the
// parser's bit packing.

interface BitFieldSpec {
  readonly name: string;
  readonly lo: number;
  readonly hi: number;
}

interface RowSpec {
  readonly u32?: readonly number[];
  readonly raw?: readonly number[];
  readonly strings?: readonly string[];
  /** The bit area exactly as stored. */
  readonly area: readonly number[];
}

export interface TableSpec {
  readonly name: string;
  readonly u32?: readonly string[];
  readonly raw?: readonly string[];
  readonly strings?: readonly string[];
  readonly bits?: readonly BitFieldSpec[];
  readonly rows: readonly RowSpec[];
  /** Overrides the record size derived from the first row, for malformed inputs. */
  readonly recordSize?: number;
}

const fieldNames = (table: TableSpec): readonly string[] => [
  ...(table.u32 ?? []),
  ...(table.raw ?? []),
  ...(table.strings ?? []),
  ...(table.bits ?? []).map((field) => field.name),
];

const recordSize = (table: TableSpec): number =>
  table.recordSize ??
  4 * fieldNames(table).length - 4 * (table.bits ?? []).length + (table.rows[0]?.area.length ?? 0);

const entryBytes = (table: TableSpec): number =>
  28 + 8 * (table.bits ?? []).length + 4 * fieldNames(table).length;

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => total + value, 0);

/** Start offsets of consecutive blocks with the given sizes. */
const offsets = (start: number, sizes: readonly number[]): readonly number[] =>
  sizes.map((_, index) => start + sum(sizes.slice(0, index)));

/** A database in the fifa.db layout. Names and string values go to a pool after the data blocks. */
export const buildEaDb = (tables: readonly TableSpec[]): Uint8Array => {
  const directoryStart = 12 + 4 * (tables.length + 1);
  const entryOffsets = offsets(directoryStart, tables.map(entryBytes));
  const lookup = directoryStart + sum(tables.map(entryBytes));
  const blockSizes = tables.map((table) => 8 + table.rows.length * recordSize(table));
  const blockOffsets = offsets(lookup + 12, blockSizes);
  const poolStart = lookup + 12 + sum(blockSizes);
  const pool: Uint8Array[] = [];
  const intern = (text: string): number => {
    const encoded = new TextEncoder().encode(text);
    const offset = poolStart + sum(pool.map((item) => item.length));
    const item = new Uint8Array(2 + encoded.length);
    new DataView(item.buffer).setUint16(0, encoded.length, true);
    item.set(encoded, 2);
    pool.push(item);
    return offset;
  };
  const main = new Uint8Array(poolStart);
  const view = new DataView(main.buffer);
  view.setUint32(4, 4, true);
  view.setUint32(8, tables.length, true);
  view.setUint32(12, lookup, true);
  tables.forEach((table, index) => {
    const entry = entryOffsets[index] ?? 0;
    const block = blockOffsets[index] ?? 0;
    view.setUint32(16 + 4 * index, block, true);
    writeEntry(view, entry, table, intern);
    view.setUint32(block, table.rows.length, true);
    view.setUint32(block + 4, entry, true);
    table.rows.forEach((row, rowIndex) => {
      writeRow(main, block + 8 + rowIndex * recordSize(table), row, intern);
    });
  });
  const out = new Uint8Array(poolStart + sum(pool.map((item) => item.length)));
  out.set(main);
  pool.forEach((item, index) => {
    out.set(item, poolStart + sum(pool.slice(0, index).map((before) => before.length)));
  });
  return out;
};

const writeEntry = (
  view: DataView,
  entry: number,
  table: TableSpec,
  intern: (text: string) => number,
): void => {
  const bits = table.bits ?? [];
  const counts = [table.u32, table.raw, table.strings, bits].map((list) => list?.length ?? 0);
  [intern(table.name), 0, recordSize(table), ...counts].forEach((word, index) => {
    view.setUint32(entry + 4 * index, word, true);
  });
  bits.forEach((field, index) => {
    view.setInt32(entry + 28 + 8 * index, field.lo, true);
    view.setInt32(entry + 32 + 8 * index, field.hi, true);
  });
  fieldNames(table).forEach((name, index) => {
    view.setUint32(entry + 28 + 8 * bits.length + 4 * index, intern(name), true);
  });
};

const writeRow = (
  bytes: Uint8Array,
  record: number,
  row: RowSpec,
  intern: (text: string) => number,
): void => {
  const words = [...(row.u32 ?? []), ...(row.raw ?? []), ...(row.strings ?? []).map(intern)];
  const view = new DataView(bytes.buffer);
  words.forEach((word, index) => {
    view.setUint32(record + 4 * index, word, true);
  });
  bytes.set(row.area, record + 4 * words.length);
};
