// Synthetic FIFA 10 locale files for tests: a <lang>.loc string table and the string.idx that keys it.
const LOCH_BYTES = 0x14;
const LOCL_HEAD_BYTES = 16;
const IDX_MAGIC = 0x20040519;

const utf16 = (text: string): Uint8Array => {
  const bytes = new Uint8Array((text.length + 1) * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < text.length; index += 1) {
    view.setUint16(index * 2, text.charCodeAt(index), true);
  }
  return bytes;
};

const padded = (length: number): number => Math.ceil(length / 4) * 4;

/** A .loc file holding `strings` in order: LOCH header, LOCL section, offsets, padded UTF-16LE text. */
export const buildLoc = (strings: readonly string[]): Uint8Array => {
  const encoded = strings.map(utf16);
  const tableBytes = LOCL_HEAD_BYTES + strings.length * 4;
  const size =
    LOCH_BYTES + tableBytes + encoded.reduce((sum, text) => sum + padded(text.length), 0);
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("LOCH"), 0);
  view.setUint32(4, LOCH_BYTES, true);
  view.setUint32(12, 1, true);
  view.setUint32(16, LOCH_BYTES, true);
  bytes.set(new TextEncoder().encode("LOCL"), LOCH_BYTES);
  view.setUint32(LOCH_BYTES + 4, size - LOCH_BYTES, true);
  view.setUint32(LOCH_BYTES + 12, strings.length, true);
  let offset = tableBytes;
  encoded.forEach((text, index) => {
    view.setUint32(LOCH_BYTES + LOCL_HEAD_BYTES + index * 4, offset, true);
    bytes.set(text, LOCH_BYTES + offset);
    offset += padded(text.length);
  });
  return bytes;
};

/** A string.idx mapping each key to a string index, sorted by key as the game writes it. */
export const buildStringIdx = (entries: readonly (readonly [number, number])[]): Uint8Array => {
  const bytes = new Uint8Array(8 + entries.length * 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, IDX_MAGIC, true);
  view.setUint32(4, entries.length, true);
  entries
    .toSorted(([a], [b]) => a - b)
    .forEach(([key, index], position) => {
      view.setUint32(8 + position * 8, key, true);
      view.setUint32(12 + position * 8, index, true);
    });
  return bytes;
};

/** A matching .loc and string.idx for a key -> text table. */
export const buildLocale = (
  table: readonly (readonly [number, string])[],
): { readonly loc: Uint8Array; readonly idx: Uint8Array } => ({
  loc: buildLoc(table.map(([, text]) => text)),
  idx: buildStringIdx(table.map(([key], index) => [key, index])),
});
