import { describe, expect, it } from "vitest";
import {
  checkSetName,
  filterSetsAfter,
  renamedSet,
  savedSet,
  usesPotential,
  withoutSet,
} from "./saved-filters.ts";
import type { FilterSet } from "./saved-filters.ts";

const BY_AGE = { key: "age", direction: "ascending" } as const;
const set = (name: string, min = 70): FilterSet => ({
  name,
  filters: { ranges: { overall: { min } } },
  sort: BY_AGE,
});

describe("checkSetName", () => {
  const sets = [set("A"), set("B")];

  it("gives the trimmed name when no set has it", () => {
    expect(checkSetName(sets, " C ")).toEqual({ ok: true, name: "C" });
  });

  it("refuses an empty name, and a name a set has", () => {
    expect(checkSetName(sets, "   ")).toEqual({ ok: false, error: "empty" });
    expect(checkSetName(sets, " B")).toEqual({ ok: false, error: "taken" });
  });

  it("lets a renamed set keep its own name, not take another set's", () => {
    expect(checkSetName(sets, "A ", "A")).toEqual({ ok: true, name: "A" });
    expect(checkSetName(sets, "B", "A")).toEqual({ ok: false, error: "taken" });
  });
});

describe("savedSet", () => {
  it("adds a new set last, its name trimmed", () => {
    expect(savedSet([set("A")], set("  B  ")).map((each) => each.name)).toEqual(["A", "B"]);
  });

  it("overwrites a set of the same name in its place", () => {
    const sets = savedSet([set("A"), set("B")], set("A", 80));
    expect(sets.map((each) => each.name)).toEqual(["A", "B"]);
    expect(sets[0]?.filters.ranges?.overall).toEqual({ min: 80 });
  });

  it("saves nothing without a name", () => {
    const sets = [set("A")];
    expect(savedSet(sets, set("   "))).toBe(sets);
  });
});

describe("renamedSet", () => {
  it("renames a set in its place", () => {
    expect(renamedSet([set("A"), set("B")], "A", " C ").map((each) => each.name)).toEqual([
      "C",
      "B",
    ]);
  });

  it("refuses an empty name or one another set has", () => {
    const sets = [set("A"), set("B")];
    expect(renamedSet(sets, "A", " ")).toBe(sets);
    expect(renamedSet(sets, "A", "B")).toBe(sets);
  });
});

describe("withoutSet", () => {
  it("deletes a set by name", () => {
    expect(withoutSet([set("A"), set("B")], "A").map((each) => each.name)).toEqual(["B"]);
  });
});

describe("usesPotential", () => {
  it("tells a set that filters or sorts by a value of the potential", () => {
    expect(usesPotential(set("A"))).toBe(false);
    expect(usesPotential({ ...set("A"), filters: { ranges: { growth: undefined } } })).toBe(false);
    expect(usesPotential({ ...set("A"), filters: { ranges: { growth: { min: 5 } } } })).toBe(true);
    expect(usesPotential({ ...set("A"), sort: { key: "peak", direction: "descending" } })).toBe(
      true,
    );
  });
});

describe("filterSetsAfter", () => {
  it("leaves the preferences alone when the set to load is gone", () => {
    const preferences = { filters: {}, sort: BY_AGE, showPotential: false, filterSets: [set("A")] };
    expect(filterSetsAfter(preferences, { type: "filter-set-loaded", name: "B" }, null)).toBe(
      preferences,
    );
  });
});
