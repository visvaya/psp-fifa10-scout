// Synthetic game graphics for tests: BIG4 entry tables, RefPack streams of literals and SHPM images.
const RGBA_BYTES = 4;

/** A BIG4 table: "BIG4", the entry count (u32 BE) at 8, then per entry offset, size (u32 BE) and name. */
export const buildBig4 = (
  entries: readonly (readonly [name: string, offset: number, size: number])[],
): Uint8Array => {
  const names = entries.map(([name]) => new TextEncoder().encode(`${name}\0`));
  const bytes = new Uint8Array(16 + names.reduce((sum, name) => sum + 8 + name.length, 0));
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("BIG4"), 0);
  view.setUint32(8, entries.length, false);
  let at = 16;
  entries.forEach(([, offset, size], index) => {
    const name = names[index] ?? new Uint8Array(0);
    view.setUint32(at, offset, false);
    view.setUint32(at + 4, size, false);
    bytes.set(name, at + 8);
    at += 8 + name.length;
  });
  return bytes;
};

/** A RefPack stream of literals only: blocks of up to 112 bytes, then the stop code with the last 0..3. */
export const refpackLiterals = (plain: Uint8Array): Uint8Array => {
  const out = [0x10, 0xfb, (plain.length >> 16) & 0xff, (plain.length >> 8) & 0xff];
  out.push(plain.length & 0xff);
  let at = 0;
  while (plain.length - at >= 4) {
    const length = Math.min(112, (plain.length - at) & ~3);
    out.push(0xe0 + length / 4 - 1, ...plain.subarray(at, at + length));
    at += length;
  }
  out.push(0xfc + plain.length - at, ...plain.subarray(at));
  return Uint8Array.from(out);
};

/**
 * An SHPM file with one 8-bit indexed image (rows padded to 16 bytes) at offset 32 and its palette after
 * it: `pixels` are palette indexes row by row, `palette` up to 256 RGBA colours.
 */
export const buildShpm = (
  width: number,
  height: number,
  pixels: readonly number[],
  palette: readonly (readonly number[])[],
): Uint8Array => {
  const stride = Math.ceil(width / 16) * 16;
  const image = 32;
  const blockBytes = 16 + stride * height;
  const bytes = new Uint8Array(image + blockBytes + 16 + 256 * RGBA_BYTES);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("SHPM"), 0);
  view.setUint32(4, bytes.length, true);
  view.setUint32(8, 1, true);
  bytes.set(new TextEncoder().encode("img0"), 16);
  view.setUint32(20, image, true);
  view.setUint32(image, 0x5d | (blockBytes << 8), true);
  view.setUint16(image + 4, width, true);
  view.setUint16(image + 6, height, true);
  pixels.forEach((index, at) => {
    bytes[image + 16 + Math.floor(at / width) * stride + (at % width)] = index;
  });
  const colours = image + blockBytes;
  view.setUint32(colours, 0x3b | ((16 + 256 * RGBA_BYTES) << 8), true);
  palette.forEach((colour, index) => {
    bytes.set(colour, colours + 16 + index * RGBA_BYTES);
  });
  return bytes;
};
