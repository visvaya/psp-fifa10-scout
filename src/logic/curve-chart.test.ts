import { describe, expect, it } from "vitest";
import { curveChart, ovrChart } from "./curve-chart.ts";
import { CURVE_COLUMNS } from "./overall-rating.ts";

/** Each age of the table, 15..45, at `value(age)`. */
const byAge = (value: (age: number) => number): readonly number[] =>
  CURVE_COLUMNS.map((_, index) => value(15 + index));

// Curve 13 rises from 20 at 15, the table's lowest value, by 5 a year to 80 at 27 and stays there; curve
// 1 tops the table at 99.
const CURVES = new Map([
  [1, byAge(() => 99)],
  [13, byAge((age) => 20 + 5 * Math.min(age - 15, 12))],
  // Rises to 42 at 26, 50 from 27 to 30, 49 (98 % of its top) at 31, then falls by 1 a year.
  [14, byAge((age) => (age < 27 ? 20 + 2 * (age - 15) : age <= 30 ? 50 : 50 - (age - 30)))],
]);

describe("curveChart", () => {
  it("puts ages 15 to 45 on x, eight units a year, with a tick every five years", () => {
    const chart = curveChart(CURVES, 13, 22);
    expect(chart?.viewBox).toBe("0 0 300 216");
    expect(chart?.plot).toEqual({ left: 36, right: 276, top: 16, bottom: 176 });
    expect(chart?.points).toHaveLength(31);
    expect(chart?.points[0]).toEqual({ age: 15, value: 20, x: 36, y: 176 });
    expect(chart?.points.at(-1)).toMatchObject({ age: 45, x: 276 });
    expect(chart?.ageTicks).toEqual(
      [15, 20, 25, 30, 35, 40, 45].map((age) => ({ label: age, at: 36 + 8 * (age - 15) })),
    );
  });

  it("puts the table's lowest to highest value on y, the scale every curve shares, with round ticks", () => {
    const chart = curveChart(CURVES, 13, 22);
    // 160 units for the 79 between 20 and 99.
    expect(chart?.points[12]?.y).toBeCloseTo(16 + (160 * 19) / 79);
    expect(curveChart(CURVES, 1, 22)?.points[0]?.y).toBe(16);
    expect(chart?.valueTicks.map((tick) => tick.label)).toEqual([20, 40, 60, 80]);
    expect(chart?.valueTicks[0]?.at).toBe(176);
  });

  it("marks the first age at the highest value and the player's age", () => {
    const chart = curveChart(CURVES, 13, 22);
    expect(chart?.peak).toMatchObject({ age: 27, value: 80, x: 132 });
    expect(chart?.now).toMatchObject({ age: 22, value: 55, x: 92 });
  });

  it("marks no age outside the table's ages", () => {
    expect(curveChart(CURVES, 13, 14)?.now).toBeUndefined();
    expect(curveChart(CURVES, 13, 46)?.now).toBeUndefined();
    expect(curveChart(CURVES, 13, 45)?.now).toMatchObject({ age: 45 });
  });

  it("falls back to curve 1 for a curve the table lacks, and draws nothing without curves", () => {
    expect(curveChart(CURVES, 7, 22)).toEqual(curveChart(CURVES, 1, 22));
    expect(curveChart(new Map(), 13, 22)).toBeNull();
  });

  it("ticks whole values only, also on a flat table", () => {
    const chart = curveChart(new Map([[1, byAge(() => 50)]]), 1, 22);
    expect(chart?.valueTicks.map((tick) => tick.label)).toEqual([49, 50]);
    expect(chart?.points[0]?.y).toBe(16);
  });

  it("spans the peak over the ages at 98 % of the curve's top or more, half a year past each end", () => {
    expect(curveChart(CURVES, 14, 22)?.plateau).toEqual({
      from: 27,
      to: 31,
      left: 36 + 8 * 11.5,
      right: 36 + 8 * 16.5,
    });
    // A flat curve peaks at every age, within the plot.
    expect(curveChart(CURVES, 1, 22)?.plateau).toEqual({ from: 15, to: 45, left: 36, right: 276 });
  });

  it.each([
    [14, 26, "before"],
    [14, 27, "peak"],
    [14, 31, "peak"],
    [14, 32, "after"],
    [1, 14, "before"],
    [1, 15, "peak"],
    [1, 45, "peak"],
    [1, 46, "after"],
  ] as const)("places curve %i at age %i %s its peak", (id, age, phase) => {
    expect(curveChart(CURVES, id, age)?.phase).toBe(phase);
  });
});

// Owner, 2026-11-07: with a career the large chart's axis is his OVR, projected from this season's age.
describe("ovrChart", () => {
  // 22 this season: 60, then 62, 64 at 24, 64, 63 at 26.
  const chart = ovrChart([60, 62, 64, 64, 63], 22);

  it("spans his ages from this season's to the last projected, on the plot's width", () => {
    expect(chart?.kind).toBe("ovr");
    expect(chart?.points).toHaveLength(5);
    expect(chart?.points[0]).toMatchObject({ age: 22, value: 60, x: 36, y: 176 });
    expect(chart?.points.at(-1)).toMatchObject({ age: 26, x: 276 });
    // Ticks at the ages that end in 0 or 5.
    expect(chart?.ageTicks.map((tick) => tick.label)).toEqual([25]);
  });

  it("puts his lowest to highest OVR on y and marks the peak, its ages and this season", () => {
    expect(chart?.points[2]?.y).toBe(16);
    expect(chart?.peak).toMatchObject({ age: 24, value: 64 });
    expect(chart?.now).toMatchObject({ age: 22, value: 60 });
    // 98 % of 64 is 62,72: 64, 64 and 63.
    expect(chart?.plateau).toMatchObject({ from: 24, to: 26 });
    expect(chart?.phase).toBe("before");
  });

  it("draws one season too, and nothing without a projection", () => {
    expect(ovrChart([70], 45)?.points).toEqual([{ age: 45, value: 70, x: 36, y: 16 }]);
    expect(ovrChart([], 22)).toBeNull();
  });
});
