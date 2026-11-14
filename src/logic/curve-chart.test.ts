import { describe, expect, it } from "vitest";
import {
  curveChart,
  ovrChart,
  pastRetirement,
  readIndexAt,
  steppedReadIndex,
  withRetirement,
} from "./curve-chart.ts";
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
    expect(chart?.viewBox).toBe("0 0 318 216");
    expect(chart?.plot).toEqual({ left: 54, right: 294, top: 16, bottom: 176 });
    expect(chart?.points).toHaveLength(31);
    expect(chart?.points[0]).toEqual({ age: 15, value: 20, x: 54, y: 176 });
    expect(chart?.points.at(-1)).toMatchObject({ age: 45, x: 294 });
    expect(chart?.ageTicks).toEqual(
      [15, 20, 25, 30, 35, 40, 45].map((age) => ({ label: age, at: 54 + 8 * (age - 15) })),
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
    expect(chart?.peak).toMatchObject({ age: 27, value: 80, x: 150 });
    expect(chart?.now).toMatchObject({ age: 22, value: 55, x: 110 });
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
      left: 54 + 8 * 11.5,
      right: 54 + 8 * 16.5,
    });
    // A flat curve peaks at every age, within the plot.
    expect(curveChart(CURVES, 1, 22)?.plateau).toEqual({ from: 15, to: 45, left: 54, right: 294 });
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
/** Where an OVR sits on the plot: 99 on its top edge (16), 40 on its bottom one (176). */
const yAt = (overall: number): number => 16 + ((99 - overall) * 160) / 59;

describe("ovrChart", () => {
  // 22 this season: 60, then 62, 64 at 24, 64, 63 at 26.
  const chart = ovrChart([60, 62, 64, 64, 63], 22);

  it("spans his ages from this season's to the last projected, on the plot's width", () => {
    expect(chart?.kind).toBe("ovr");
    expect(chart?.points).toHaveLength(5);
    expect(chart?.points[0]).toMatchObject({ age: 22, value: 60, x: 54 });
    expect(chart?.points.at(-1)).toMatchObject({ age: 26, x: 294 });
    // Ticks at the ages that end in 0 or 5.
    expect(chart?.ageTicks.map((tick) => tick.label)).toEqual([25]);
  });

  // Owner, 2026-11-14 (roadmap 128): one OVR scale for every player, 40 to 99, so his peak's level shows
  // at a glance and compares with another's; before, his own lowest to highest filled the plot.
  it("puts every player on one OVR scale, 40 to 99, and marks the peak, its ages and this season", () => {
    expect(chart?.points[0]?.y).toBeCloseTo(yAt(60));
    expect(chart?.points[2]?.y).toBeCloseTo(yAt(64));
    expect(chart?.valueTicks.map((tick) => tick.label)).toEqual([40, 60, 80]);
    expect(chart?.peak).toMatchObject({ age: 24, value: 64 });
    expect(chart?.now).toMatchObject({ age: 22, value: 60 });
    // 98 % of 64 is 62,72: 64, 64 and 63.
    expect(chart?.plateau).toMatchObject({ from: 24, to: 26 });
    expect(chart?.phase).toBe("before");
  });

  it("keeps an OVR under 40 on the plot's bottom edge", () => {
    expect(ovrChart([45, 35], 40)?.points.map((point) => point.y)).toEqual([yAt(45), 176]);
  });

  it("draws one season too, and nothing without a projection", () => {
    expect(ovrChart([70], 45)?.points[0]).toMatchObject({ age: 45, value: 70, x: 54 });
    expect(ovrChart([99], 45)?.points[0]?.y).toBe(16);
    expect(ovrChart([], 22)).toBeNull();
  });
});

// Owner, 2026-11-13: a finger or the mouse along the chart reads the level at an age; so do the keys.
describe("reading the chart at an age", () => {
  const chart = curveChart(CURVES, 13, 22);
  if (chart === null) throw new Error("The test curve has no chart");

  it("reads the age nearest the pointer along the plot's width, clamped to its ends", () => {
    expect(readIndexAt(chart, 0)).toBe(0);
    expect(readIndexAt(chart, 1)).toBe(30);
    // 31 ages, 30 steps: a share of 0,25 lies at 7,5 steps, read as 8 (age 23).
    expect(readIndexAt(chart, 0.25)).toBe(8);
    expect(readIndexAt(chart, -0.2)).toBe(0);
    expect(readIndexAt(chart, 1.3)).toBe(30);
  });

  it("steps a year with the arrows and to the ends with Home and End", () => {
    expect(steppedReadIndex(chart, 3, "ArrowRight")).toBe(4);
    expect(steppedReadIndex(chart, 3, "ArrowUp")).toBe(4);
    expect(steppedReadIndex(chart, 3, "ArrowLeft")).toBe(2);
    expect(steppedReadIndex(chart, 3, "ArrowDown")).toBe(2);
    expect(steppedReadIndex(chart, 3, "Home")).toBe(0);
    expect(steppedReadIndex(chart, 3, "End")).toBe(30);
    expect(steppedReadIndex(chart, 0, "ArrowLeft")).toBe(0);
    expect(steppedReadIndex(chart, 30, "ArrowRight")).toBe(30);
  });

  it("steps from this season's age before any reading, and leaves other keys alone", () => {
    // 22 this season is the eighth age from 15.
    expect(steppedReadIndex(chart, null, "ArrowRight")).toBe(8);
    expect(steppedReadIndex(chart, null, "Escape")).toBeNull();
    expect(steppedReadIndex(chart, 3, "Tab")).toBeNull();
    const outside = curveChart(CURVES, 13, 50);
    if (outside === null) throw new Error("The test curve has no chart");
    expect(steppedReadIndex(outside, null, "ArrowRight")).toBe(1);
  });
});

describe("withRetirement", () => {
  // His OVR from 30, this season, to 45.
  const chart = ovrChart(
    Array.from({ length: 16 }, (_, years) => 80 - years),
    30,
  );

  it("marks his last season half a year past its point, the ages after it past his career", () => {
    const marked = withRetirement(chart, 33, 35);
    const [last, next] = [33, 34].map(
      (age) => marked?.points.find((point) => point.age === age) ?? { x: 0, y: 0 },
    );
    // Where the curve meets the line, half a year on: both of its parts end and start there.
    expect(marked?.retirement).toMatchObject({ age: 33, retirementAge: 35 });
    expect(marked?.retirement?.x).toBeCloseTo(((last?.x ?? 0) + (next?.x ?? 0)) / 2);
    expect(marked?.retirement?.y).toBeCloseTo(((last?.y ?? 0) + (next?.y ?? 0)) / 2);
  });

  it("marks this season when it is his last", () => {
    expect(withRetirement(chart, 30, 35)?.retirement?.age).toBe(30);
  });

  it("marks nothing when he plays past the chart's last age", () => {
    expect(withRetirement(chart, 45, 35)?.retirement).toBeUndefined();
    expect(withRetirement(chart, 50, 35)?.retirement).toBeUndefined();
    expect(chart?.retirement).toBeUndefined();
  });

  it("keeps a missing chart missing", () => {
    expect(withRetirement(null, 33, 35)).toBeNull();
  });
});

describe("pastRetirement", () => {
  const chart = ovrChart([80, 79, 78, 77, 76], 30);

  it("holds for the ages after his last season only", () => {
    const marked = withRetirement(chart, 32, 35);
    expect(marked === null ? [] : [32, 33].map((age) => pastRetirement(marked, age))).toEqual([
      false,
      true,
    ]);
  });

  it("never holds without a career's end on the chart", () => {
    expect(chart === null ? true : pastRetirement(chart, 34)).toBe(false);
  });
});
