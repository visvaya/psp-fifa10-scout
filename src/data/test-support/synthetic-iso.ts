// A minimal ISO 9660 image for tests: PVD in sector 16, one sector per directory, files after a one-sector
// gap so no extent starts right after the directory that lists it.
const SECTOR = 2048;
const PVD_START = 16 * SECTOR;

export interface IsoFileSpec {
  readonly path: string;
  readonly bytes: Uint8Array;
}

interface Node {
  readonly name: string;
  readonly bytes?: Uint8Array;
  readonly children: Node[];
}

const childOf = (parent: Node, name: string): Node => {
  const existing = parent.children.find((child) => child.name === name);
  if (existing !== undefined) return existing;
  const created: Node = { name, children: [] };
  parent.children.push(created);
  return created;
};

/** One directory record: 33-byte head, name, padding to an even length. */
const directoryRecord = (
  name: Uint8Array,
  sector: number,
  size: number,
  flags: number,
): Uint8Array => {
  const length = 33 + name.length + ((33 + name.length) % 2);
  const record = new Uint8Array(length);
  const view = new DataView(record.buffer);
  record[0] = length;
  view.setUint32(2, sector, true);
  view.setUint32(6, sector, false);
  view.setUint32(10, size, true);
  view.setUint32(14, size, false);
  record[25] = flags;
  record[32] = name.length;
  record.set(name, 33);
  return record;
};

const walk = (node: Node): Node[] => [node, ...node.children.flatMap(walk)];

const withVersion = (name: string): string => (name.includes(";") ? name : `${name};1`);

/** File names get the ";1" version suffix, as mastering tools write them, unless they carry one. */
export const buildIso = (files: readonly IsoFileSpec[]): Uint8Array => {
  const root: Node = { name: "", children: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    const parent = parts.slice(0, -1).reduce(childOf, root);
    parent.children.push({
      name: withVersion(parts.at(-1) ?? ""),
      bytes: file.bytes,
      children: [],
    });
  }
  const nodes = walk(root);
  const directories = nodes.filter((node) => node.bytes === undefined);
  const sectors = new Map(directories.map((node, index) => [node, 18 + index]));
  let next = 18 + directories.length + 1;
  for (const node of nodes) {
    if (node.bytes === undefined) continue;
    sectors.set(node, next);
    next += Math.ceil(node.bytes.length / SECTOR) + 1;
  }
  const record = (node: Node, name: Uint8Array): Uint8Array =>
    directoryRecord(name, sectors.get(node) ?? 0, node.bytes?.length ?? SECTOR, node.bytes ? 0 : 2);
  const image = new Uint8Array(next * SECTOR);
  const pvd = PVD_START;
  image[pvd] = 1;
  image.set(new TextEncoder().encode("CD001"), pvd + 1);
  image[pvd + 6] = 1;
  const view = new DataView(image.buffer);
  view.setUint32(pvd + 80, next, true);
  view.setUint32(pvd + 84, next, false);
  view.setUint16(pvd + 128, SECTOR, true);
  view.setUint16(pvd + 130, SECTOR, false);
  image.set(record(root, Uint8Array.of(0)), pvd + 156);
  image.set([255, ...new TextEncoder().encode("CD001"), 1], 17 * SECTOR);
  for (const directory of directories) {
    const records = [
      record(directory, Uint8Array.of(0)),
      record(directory, Uint8Array.of(1)),
      ...directory.children.map((child) => record(child, new TextEncoder().encode(child.name))),
    ];
    let offset = (sectors.get(directory) ?? 0) * SECTOR;
    for (const bytes of records) {
      image.set(bytes, offset);
      offset += bytes.length;
    }
  }
  for (const node of nodes) {
    if (node.bytes !== undefined) image.set(node.bytes, (sectors.get(node) ?? 0) * SECTOR);
  }
  return image;
};
