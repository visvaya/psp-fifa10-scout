import { describe, expect, it } from "vitest";
import { curveChart } from "./curve-chart.ts";
import { CURVE_COLUMNS } from "./overall-rating.ts";

/** Each age of the table, 15..45, at `value(age)`. */
const byAge = (value: (age: number) => number): readonly number[] =>
  CURVE_COLUMNS.map((_, index) => value(15 + index));

// Curve 13 rises from 20 at 15, the table's lowest value, by 5 a year to 80 at 27 and stays there; curve
// 1 tops the table at 99.
const CURVES = new Map([
  [1, byAge(() => 99)],
  [13, byAge((age) => 20 + 5 * Math.min(age - 15, 12))],
]);

describe("curveChart", () => {
  it("puts ages 15 to 45 on x, ten units a year, with a tick every five years", () => {
    const chart = curveChart(CURVES, 13, 22);
    expect(chart?.viewBox).toBe("0 0 360 240");
    expect(chart?.plot).toEqual({ left: 44, right: 344, top: 24, bottom: 200 });
    expect(chart?.points).toHaveLength(31);
    expect(chart?.points[0]).toEqual({ age: 15, value: 20, x: 44, y: 200 });
    expect(chart?.points.at(-1)).toMatchObject({ age: 45, x: 344 });
    expect(chart?.ageTicks).toEqual(
      [15, 20, 25, 30, 35, 40, 45].map((age) => ({ label: age, at: 44 + 10 * (age - 15) })),
    );
  });

  it("puts the table's lowest to highest value on y, the scale every curve shares, with round ticks", () => {
    const chart = curveChart(CURVES, 13, 22);
    // 176 units for the 79 between 20 and 99.
    expect(chart?.points[12]?.y).toBeCloseTo(24 + (176 * 19) / 79);
    expect(curveChart(CURVES, 1, 22)?.points[0]?.y).toBe(24);
    expect(chart?.valueTicks.map((tick) => tick.label)).toEqual([20, 40, 60, 80]);
    expect(chart?.valueTicks[0]?.at).toBe(200);
  });

  it("marks the first age at the highest value and the player's age", () => {
    const chart = curveChart(CURVES, 13, 22);
    expect(chart?.peak).toMatchObject({ age: 27, value: 80, x: 164 });
    expect(chart?.now).toMatchObject({ age: 22, value: 55, x: 114 });
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
    expect(chart?.points[0]?.y).toBe(24);
  });
});
