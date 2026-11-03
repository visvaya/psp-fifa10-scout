// Synthetic FIFA 10 career saves for tests: a 16-byte header, then table chunks with zero padding.
// Records, string pools and bitmaps are given as bytes, so the builder does not repeat the parser.

export interface ChunkSpec {
  readonly index: number;
  readonly directoryOffset: number;
  readonly rows: number;
  /** The records exactly as stored. */
  readonly records: readonly number[];
  readonly pool?: readonly number[];
  readonly bitmap: readonly number[];
  /** Overrides the block length 8 + records, for malformed inputs. */
  readonly length?: number;
  /** Zero bytes before the chunk. */
  readonly padding?: number;
}

/** A u32 as four little-endian bytes. */
export const le32 = (value: number): readonly number[] =>
  [0, 8, 16, 24].map((shift) => (value >>> shift) & 0xff);

/** A string pool entry: u16 length and UTF-8 bytes. */
export const poolString = (text: string): readonly number[] => {
  const encoded = new TextEncoder().encode(text);
  return [encoded.length & 0xff, encoded.length >>> 8, ...encoded];
};

const chunkBytes = (chunk: ChunkSpec): readonly number[] => {
  const pool = chunk.pool ?? [];
  const body = [
    ...le32(4),
    ...le32(chunk.index),
    ...le32(chunk.length ?? 8 + chunk.records.length),
    ...le32(chunk.rows),
    ...le32(chunk.directoryOffset),
    ...chunk.records,
    ...le32(pool.length),
    ...pool,
    ...le32(chunk.bitmap.length),
    ...chunk.bitmap,
  ];
  return [
    ...Array<number>(chunk.padding ?? 0).fill(0),
    ...body,
    ...Array<number>(-body.length & 3).fill(0),
  ];
};

export const buildCareerSave = (chunks: readonly ChunkSpec[]): Uint8Array => {
  const body = chunks.flatMap(chunkBytes);
  return Uint8Array.from([...le32(16 + body.length), ...Array<number>(12).fill(0), ...body]);
};
