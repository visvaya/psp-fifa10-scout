// A development curve drawn large: ages on x, values on y on the scale every curve of the table shares.
import { curveScale } from "./curve-sparkline.ts";
import { CURVE_AGE_MIN, curveValues } from "./overall-rating.ts";
import type { Curves } from "./overall-rating.ts";

/** The chart's size and the margins around its plot, for the ticks' labels and the axes' titles. */
const LAYOUT_UNITS = { width: 360, height: 240, left: 44, right: 16, top: 24, bottom: 40 } as const;
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
}

/** A whole step of 1, 2 or 5 times a power of ten that splits `span` into at most MAX_VALUE_TICKS. */
const valueStep = (span: number): number => {
  const raw = span / MAX_VALUE_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((size) => size >= raw);
  return Math.max(step ?? raw, 1);
};

/** Curve `id` on the table's shared scale, with the player at `age`; null without curves. */
export const curveChart = (curves: Curves, id: number, age: number): CurveChart | null => {
  const values = curveValues(curves, id);
  if (values.length === 0) return null;
  const { top, height } = curveScale(curves);
  const { width, height: chartHeight, left, right, top: plotTop, bottom } = LAYOUT_UNITS;
  const plot = { left, right: width - right, top: plotTop, bottom: chartHeight - bottom };
  const lastAge = CURVE_AGE_MIN + values.length - 1;
  const xOf = (at: number) =>
    left + ((at - CURVE_AGE_MIN) / (lastAge - CURVE_AGE_MIN)) * (plot.right - left);
  const yOf = (value: number) => plotTop + ((top - value) / height) * (plot.bottom - plotTop);
  const point = (value: number, index: number): ChartPoint => {
    const at = CURVE_AGE_MIN + index;
    return { age: at, value, x: xOf(at), y: yOf(value) };
  };
  const points = values.map(point);
  const step = valueStep(height);
  const lowestTick = Math.ceil((top - height) / step) * step;
  const max = Math.max(...values);
  return {
    viewBox: `0 0 ${String(width)} ${String(chartHeight)}`,
    plot,
    points,
    ageTicks: points
      .filter((at) => (at.age - CURVE_AGE_MIN) % AGE_TICK_YEARS === 0)
      .map((at) => ({ label: at.age, at: at.x })),
    valueTicks: Array.from(
      { length: Math.floor((top - lowestTick) / step) + 1 },
      (_, index) => lowestTick + index * step,
    ).map((value) => ({ label: value, at: yOf(value) })),
    peak: point(max, values.indexOf(max)),
    // Negative or past the last age: no point.
    now: points[age - CURVE_AGE_MIN],
  };
};
