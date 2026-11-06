import { describe, expect, it } from "vitest";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

/** Stored preferences with the peak ranged and sorted by the best position's, the flag as given. */
const loadBestPeak = async (peakAtBest: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", {
    schemaVersion: SCHEMA_VERSION.preferences,
    value: {
      filters: { peakAtBest, ranges: { peak: { min: 80 } } },
      sort: { key: "bestPeak", direction: "descending" },
      showPotential: true,
    },
  });
  return (await createScoutStore(backend).load()).preferences;
};

describe("stored peak at the best position", () => {
  it("restores the flag and the sort by the best peak", async () => {
    expect(await loadBestPeak(true)).toEqual({
      filters: { peakAtBest: true, ranges: { peak: { min: 80 } } },
      sort: { key: "bestPeak", direction: "descending" },
      showPotential: true,
    });
  });

  it("drops a flag that is not true, keeping the range", async () => {
    const loaded = await Promise.all(["yes", false, undefined].map(loadBestPeak));
    expect(loaded.map((preferences) => preferences?.filters)).toEqual([
      { ranges: { peak: { min: 80 } } },
      { ranges: { peak: { min: 80 } } },
      { ranges: { peak: { min: 80 } } },
    ]);
  });
});
