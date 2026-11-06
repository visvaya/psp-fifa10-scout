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
