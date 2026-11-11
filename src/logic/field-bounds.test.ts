import { describe, expect, it } from "vitest";
import { boundedValue, boundsOf } from "./field-bounds.ts";
import { RANGE_KEYS } from "./filter-players.ts";

describe("the bounds of the range fields", () => {
  it("bound every range field from below, above the minimum where the game sets a maximum", () => {
    for (const key of RANGE_KEYS) {
      const { min, max, step } = boundsOf(key);
      expect(step).toBeGreaterThan(0);
      // Money has no maximum: an infinite one passes too.
      expect(max ?? Infinity).toBeGreaterThan(min);
    }
  });

  // Owner, 2026-11-11: KR as the game shows it, a match rating's scale with one decimal.
  it("keeps KR from 1,0 to 10,0 in tenths and an attribute from 1 to 99", () => {
    expect(boundsOf("form")).toEqual({ min: 1, max: 10, step: 0.1 });
    expect(boundsOf("acceleration")).toEqual({ min: 1, max: 99, step: 1 });
    expect(boundsOf("weakFoot")).toEqual({ min: 1, max: 5, step: 1 });
  });

  it("moves a value past a bound onto it and leaves the rest, an empty one included", () => {
    expect(boundedValue(boundsOf("form"), 12)).toBe(10);
    expect(boundedValue(boundsOf("form"), 0.4)).toBe(1);
    expect(boundedValue(boundsOf("form"), 6.7)).toBe(6.7);
    expect(boundedValue(boundsOf("price"), 250_000_000)).toBe(250_000_000);
    expect(boundedValue(boundsOf("price"), -5)).toBe(0);
    expect(boundedValue(boundsOf("form"), undefined)).toBeUndefined();
  });
});
