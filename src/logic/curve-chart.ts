// A development curve drawn large: ages on x, values on y on the scale every curve of the table shares.
import { curveScale } from "./curve-sparkline.ts";
import { CURVE_AGE_MIN, curveValues } from "./overall-rating.ts";
import type { Curves } from "./overall-rating.ts";

/**
 * The chart's size and the margins around its plot: the level's title turned along the axis and the
 * value ticks' labels on the left, room for the marks' size on top (the legend under the chart names
 * them), the ages and their title below. Narrow, so its text stays readable on a phone.
 */
const LAYOUT_UNITS = { width: 318, height: 216, left: 54, right: 24, top: 16, bottom: 40 } as const;
/** The peak spans the ages at this share of the curve's top or more: some curves stay flat for years. */
const PEAK_SHARE = 0.98;
const AGE_TICK_YEARS = 5;
const MAX_VALUE_TICKS = 5;

interface ChartPoint {
  readonly age: number;
  readonly value: number;
  readonly x: number;
  readonly y: number;
}

/** A tick's label and where it sits along its axis, in viewBox units. */
interface ChartTick {
  readonly label: number;
  readonly at: number;
}

export interface CurveChart {
  readonly kind: ChartKind;
  readonly viewBox: string;
  /** The plot's edges in viewBox units; the axes run along its left and bottom edges. */
  readonly plot: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  };
  /** Every age of the table with the curve's value. */
  readonly points: readonly ChartPoint[];
  readonly ageTicks: readonly ChartTick[];
  readonly valueTicks: readonly ChartTick[];
  /** The first age at the curve's highest value. */
  readonly peak: ChartPoint;
  /** The player's age, undefined outside the table's ages. */
  readonly now: ChartPoint | undefined;
  /** The peak's ages, first to last, and its band in viewBox units, half a year past each end. */
  readonly plateau: {
    readonly from: number;
    readonly to: number;
    readonly left: number;
    readonly right: number;
  };
  /** Where the player's age falls: before the peak's first age, within its ages, or after them. */
  readonly phase: CurvePhase;
}

type CurvePhase = "before" | "peak" | "after";

/** A whole step of 1, 2 or 5 times a power of ten that splits `span` into at most MAX_VALUE_TICKS. */
const valueStep = (span: number): number => {
  const raw = span / MAX_VALUE_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((size) => size >= raw);
  return Math.max(step ?? raw, 1);
};

/** What the chart's y measures: the curve's relative level, or his OVR projected by the game's model. */
type ChartKind = "curve" | "ovr";

/**
 * `values` from `firstAge` on, one a year, on the plot's width; y from `top` down `height`; the player at
 * `age`. The ticks fall on the ages that end in 0 or 5.
 */
const chartOf = ({
  values,
  firstAge,
  scale: { top, height },
  age,
  kind,
}: {
  readonly values: readonly number[];
  readonly firstAge: number;
  readonly scale: { readonly top: number; readonly height: number };
  readonly age: number;
  readonly kind: ChartKind;
}): CurveChart => {
  const { width, height: chartHeight, left, right, top: plotTop, bottom } = LAYOUT_UNITS;
  const plot = { left, right: width - right, top: plotTop, bottom: chartHeight - bottom };
  // One season alone still has a width to divide.
  const span = Math.max(values.length - 1, 1);
  const xOf = (at: number) => left + ((at - firstAge) / span) * (plot.right - left);
  const yOf = (value: number) => plotTop + ((top - value) / height) * (plot.bottom - plotTop);
  const point = (value: number, index: number): ChartPoint => {
    const at = firstAge + index;
    return { age: at, value, x: xOf(at), y: yOf(value) };
  };
  const points = values.map(point);
  const step = valueStep(height);
  const lowestTick = Math.ceil((top - height) / step) * step;
  const max = Math.max(...values);
  const atPeak = points.filter((at) => at.value >= PEAK_SHARE * max).map((at) => at.age);
  const from = Math.min(...atPeak);
  const to = Math.max(...atPeak);
  return {
    kind,
    viewBox: `0 0 ${String(width)} ${String(chartHeight)}`,
    plot,
    points,
    ageTicks: points
      .filter((at) => at.age % AGE_TICK_YEARS === 0)
      .map((at) => ({ label: at.age, at: at.x })),
    valueTicks: Array.from(
      { length: Math.floor((top - lowestTick) / step) + 1 },
      (_, index) => lowestTick + index * step,
    ).map((value) => ({ label: value, at: yOf(value) })),
    peak: point(max, values.indexOf(max)),
    // Before the first age or past the last: no point.
    now: points[age - firstAge],
    plateau: {
      from,
      to,
      left: Math.max(xOf(from - 0.5), left),
      right: Math.min(xOf(to + 0.5), plot.right),
    },
    phase: age < from ? "before" : age > to ? "after" : "peak",
  };
};

/** Curve `id` on the table's shared scale, with the player at `age`; null without curves. */
export const curveChart = (curves: Curves, id: number, age: number): CurveChart | null => {
  const values = curveValues(curves, id);
  return values.length === 0
    ? null
    : chartOf({ values, firstAge: CURVE_AGE_MIN, scale: curveScale(curves), age, kind: "curve" });
};

/**
 * His OVR from this season's age on (Player.overallByAge), from its lowest to its highest; null
 * without a projection (no career).
 */
export const ovrChart = (overallByAge: readonly number[], seasonAge: number): CurveChart | null => {
  if (overallByAge.length === 0) return null;
  const top = Math.max(...overallByAge);
  // A flat projection spans no height: one OVR keeps the chart drawable.
  const height = Math.max(top - Math.min(...overallByAge), 1);
  return chartOf({
    values: overallByAge,
    firstAge: seasonAge,
    scale: { top, height },
    age: seasonAge,
    kind: "ovr",
  });
};
