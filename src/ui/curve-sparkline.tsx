import type { JSX } from "react";
import type { Sparkline } from "../logic/curve-sparkline.ts";

/** A development curve the size of a line of text; decorative beside its name unless given a label. */
export const CurveSparkline = ({
  line,
  label,
}: {
  line: Sparkline;
  label?: string;
}): JSX.Element => (
  <svg
    className="sparkline"
    viewBox={line.viewBox}
    preserveAspectRatio="none"
    focusable="false"
    {...(label === undefined ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
  >
    <polyline points={line.points} />
  </svg>
);
