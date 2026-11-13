import { describe, expect, it } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

/** Stored preferences with the given filters and sort key. */
const loadWith = async (filters: unknown, sortKey: string) => {
  const backend = memoryBackend();
  await backend.set("preferences", {
    schemaVersion: SCHEMA_VERSION.preferences,
    value: { filters, sort: { key: sortKey, direction: "descending" }, showPotential: true },
  });
  return (await createScoutStore(backend).load()).preferences;
};

describe("stored peak at the best position", () => {
  it("restores the flag with the peak range and sort", async () => {
    expect(await loadWith({ peakAtBest: true, ranges: { peak: { min: 80 } } }, "peak")).toEqual({
      filters: { peakAtBest: true, ranges: { peak: { min: 80 } } },
      sort: { key: "peak", direction: "descending" },
      showPotential: true,
    });
  });

  it("stores only the peak: its display twins in the ranges or the sort are dropped", async () => {
    const stored = { ranges: { bestPeak: { min: 80 }, bestPeakGain: { max: 3 } } };
    const loaded = await loadWith(stored, "bestPeak");
    expect(loaded?.filters).toEqual({});
    expect(loaded?.sort).toEqual(DEFAULT_SORT);
  });
});

/** The order of the tie rules loaded from stored preferences that hold `tieOrder`. */
const loadOrder = async (tieOrder: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", {
    schemaVersion: SCHEMA_VERSION.preferences,
    value: { filters: {}, sort: DEFAULT_SORT, showPotential: true, tieOrder },
  });
  return (await createScoutStore(backend).load()).preferences?.tieOrder;
};

describe("stored order of the best peak tie rules", () => {
  it("restores the order, unknown and repeated rules dropped and missing ones added", async () => {
    expect(await loadOrder(["betterFootSide", "x", "betterFootSide", "formation"])).toEqual([
      "betterFootSide",
      "formation",
      "weakFootCentre",
      "preferredPosition",
    ]);
  });

  it("leaves the order unset when the record has none", async () => {
    expect(await loadOrder(undefined)).toBeUndefined();
    expect(await loadOrder("formation")).toBeUndefined();
  });
});

/** The preferences loaded from stored ones that hold these view switches. */
const loadSwitches = async (switches: Readonly<Record<string, unknown>>) => {
  const backend = memoryBackend();
  await backend.set("preferences", {
    schemaVersion: SCHEMA_VERSION.preferences,
    value: { filters: {}, sort: DEFAULT_SORT, showPotential: false, ...switches },
  });
  return (await createScoutStore(backend).load()).preferences;
};

describe("stored view switches", () => {
  it("restores the values after signing only when on", async () => {
    expect((await loadSwitches({ afterSigning: true }))?.afterSigning).toBe(true);
    expect((await loadSwitches({ afterSigning: "yes" }))?.afterSigning).toBeUndefined();
  });

  it("restores the approximate portraits only when on", async () => {
    expect((await loadSwitches({ approximatePortraits: true }))?.approximatePortraits).toBe(true);
    const wrong = await loadSwitches({ approximatePortraits: "yes" });
    expect(wrong?.approximatePortraits).toBeUndefined();
  });
});
