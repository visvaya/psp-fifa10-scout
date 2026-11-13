import type { JSX } from "react";
import type { curveSparklines, Sparkline } from "../logic/curve-sparkline.ts";
import { skillCurveId } from "../logic/overall-rating.ts";
import type { Choice } from "./filter-fields.tsx";
import { codeName } from "./text-code-names.ts";

/** A development curve the size of a line of text, decorative beside the name or button that says what it is. */
export const CurveSparkline = ({ line }: { line: Sparkline }): JSX.Element => (
  <svg className="sparkline" viewBox={line.viewBox} preserveAspectRatio="none" aria-hidden="true">
    <polyline points={line.points} />
  </svg>
);

/** The typical development type (text-code-names.ts): the styles' curves are drawn for it. */
const TYPICAL_DEVELOPMENT_TYPE = 2;

/** Each style with its skill curve for the typical development type, when the game has curves. */
export const styleChoices = (
  codes: readonly number[],
  sparkline: ReturnType<typeof curveSparklines>,
): readonly Choice<number>[] =>
  codes.map((code) => {
    const line = sparkline(skillCurveId(code, TYPICAL_DEVELOPMENT_TYPE));
    return {
      value: code,
      label: codeName("developmentStyle", code),
      mark: line && <CurveSparkline line={line} />,
    };
  });
