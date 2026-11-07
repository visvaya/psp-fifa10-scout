import { describe, expect, it } from "vitest";
import { curveSparklines } from "./curve-sparkline.ts";
import { CURVE_COLUMNS } from "./overall-rating.ts";

/** A curve over every age of the table: `value` at each column index. */
const curve = (value: (index: number) => number): readonly number[] =>
  CURVE_COLUMNS.map((_, index) => value(index));

// Curve 13 rises from 20, the table's lowest value, to 80 at index 12 (age 27) and stays there; curve 1 is
// flat at 40; curve 2 tops the table at 99.
const CURVES = new Map([
  [1, curve(() => 40)],
  [2, curve(() => 99)],
  [13, curve((index) => 20 + 5 * Math.min(index, 12))],
]);

describe("curveSparklines", () => {
  it("draws every age of the table on x and its lowest to highest value on y, the same for every curve", () => {
    const line = curveSparklines(CURVES)(13);
    expect(line?.viewBox).toBe(`0 0 ${String(CURVE_COLUMNS.length - 1)} 79`);
    const points = line?.points.split(" ");
    expect(points).toHaveLength(CURVE_COLUMNS.length);
    expect(points?.[0]).toBe("0,79");
    expect(points?.[12]).toBe("12,19");
    expect(points?.at(-1)).toBe(`${String(CURVE_COLUMNS.length - 1)},19`);
    expect(curveSparklines(CURVES)(1)?.viewBox).toBe(line?.viewBox);
  });

  it("names the first age at the curve's highest value", () => {
    expect(curveSparklines(CURVES)(13)?.peakAge).toBe(27);
    expect(curveSparklines(CURVES)(1)?.peakAge).toBe(15);
  });

  it("falls back to curve 1 for a curve the table lacks, as the game does", () => {
    expect(curveSparklines(CURVES)(7)).toEqual(curveSparklines(CURVES)(1));
  });

  it("draws nothing without curves", () => {
    expect(curveSparklines(new Map())(13)).toBeNull();
  });

  it("draws a flat table as a flat line at the top", () => {
    const line = curveSparklines(new Map([[1, curve(() => 50)]]))(1);
    expect(line?.viewBox).toBe(`0 0 ${String(CURVE_COLUMNS.length - 1)} 1`);
    expect(new Set(line?.points.split(" ").map((point) => point.split(",")[1]))).toEqual(
      new Set(["0"]),
    );
  });
});
