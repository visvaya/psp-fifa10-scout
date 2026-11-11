// A development curve drawn small, on the scale every curve of the table shares, so shapes compare.
import { curveValues } from "./overall-rating.ts";
import type { Curves } from "./overall-rating.ts";

export interface Sparkline {
  /** x over the table's ages, y from the table's highest value (top) down to its lowest. */
  readonly viewBox: string;
  /** The curve's polyline in viewBox units. */
  readonly points: string;
}

/** The table's highest value and the span down to its lowest, which every curve is drawn on. */
export const curveScale = (curves: Curves): { readonly top: number; readonly height: number } => {
  const all = [...curves.values()].flat();
  const top = Math.max(...all);
  // A flat table spans no height: one unit keeps a chart drawable.
  return { top, height: Math.max(top - Math.min(...all), 1) };
};

/**
 * The table's shared scale, taken once, and from it each curve `id` as a polyline; null without curves.
 * A flat table draws a flat line at the top.
 */
export const curveSparklines = (curves: Curves): ((id: number) => Sparkline | null) => {
  const { top, height } = curveScale(curves);
  return (id) => {
    const values = curveValues(curves, id);
    if (values.length === 0) return null;
    return {
      viewBox: `0 0 ${String(values.length - 1)} ${String(height)}`,
      points: values.map((value, index) => `${String(index)},${String(top - value)}`).join(" "),
    };
  };
};

/**
 * His projected OVR (Player.overallByAge) as a polyline, from its highest at the top to its lowest: the
 * large OVR chart's line in small. Null without a projection.
 */
export const ovrSparkline = (overallByAge: readonly number[]): Sparkline | null => {
  if (overallByAge.length === 0) return null;
  const top = Math.max(...overallByAge);
  const height = Math.max(top - Math.min(...overallByAge), 1);
  return {
    viewBox: `0 0 ${String(Math.max(overallByAge.length - 1, 1))} ${String(height)}`,
    points: overallByAge.map((value, index) => `${String(index)},${String(top - value)}`).join(" "),
  };
};
