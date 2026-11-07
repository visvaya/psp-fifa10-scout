import type { JSX } from "react";
import type { Sparkline } from "../logic/curve-sparkline.ts";

/** A development curve the size of a line of text, decorative beside the name or button that says what it is. */
export const CurveSparkline = ({ line }: { line: Sparkline }): JSX.Element => (
  <svg className="sparkline" viewBox={line.viewBox} preserveAspectRatio="none" aria-hidden="true">
    <polyline points={line.points} />
  </svg>
);
