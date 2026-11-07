// Reading stored records of unknown shape, shared by the store and the preferences migrations.

export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The value of a { schemaVersion, value } record of that version, else undefined. */
export const versioned = (record: unknown, version: number): unknown =>
  isRecord(record) && record["schemaVersion"] === version ? record["value"] : undefined;

export const recordOf = (value: unknown): Readonly<Record<string, unknown>> =>
  isRecord(value) ? value : {};

export const isFiniteNumber = (value: unknown): value is number => Number.isFinite(value);
