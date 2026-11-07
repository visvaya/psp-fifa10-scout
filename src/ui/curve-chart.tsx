import { useCallback, useRef, useState } from "react";
import type { JSX } from "react";
import type { CurveChart } from "../logic/curve-chart.ts";
import type { Sparkline } from "../logic/curve-sparkline.ts";
import { CurveSparkline } from "./curve-sparkline.tsx";
import { Facts } from "./facts.tsx";
import { FieldHelp } from "./field-help.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { formatNumber, TEXT } from "./text.ts";
import { HELP_TEXT } from "./text-help.ts";

/** Room in viewBox units between a label and its axis, a mark or the chart's edge. */
const GAP = 6;
const LABEL_LINE = 14;

/** A label over x: from x near the plot's left edge, up to x near its right edge, else centred. */
const edgeAnchor = (x: number, { left, right }: CurveChart["plot"]): "start" | "middle" | "end" => {
  const third = (right - left) / 3;
  return x < left + third ? "start" : x > right - third ? "end" : "middle";
};

/** Grid lines at the value ticks, the ticks' labels, both axes and the ages' title. */
const ChartAxes = ({ chart: { plot, valueTicks, ageTicks } }: { chart: CurveChart }) => (
  <>
    {valueTicks.map(({ label, at }) => (
      <g key={label}>
        <line className="grid" x1={plot.left} x2={plot.right} y1={at} y2={at} />
        <text x={plot.left - GAP} y={at} textAnchor="end" dominantBaseline="middle">
          {formatNumber(label)}
        </text>
      </g>
    ))}
    {ageTicks.map(({ label, at }) => (
      <text key={label} x={at} y={plot.bottom + LABEL_LINE + GAP} textAnchor="middle">
        {label}
      </text>
    ))}
    <path
      className="axis"
      d={`M${String(plot.left)},${String(plot.top)}V${String(plot.bottom)}H${String(plot.right)}`}
    />
    <text
      className="axis-title"
      x={(plot.left + plot.right) / 2}
      y={plot.bottom + 2 * LABEL_LINE + GAP + 2}
      textAnchor="middle"
    >
      {TEXT.card.curveAge}
    </text>
  </>
);

/**
 * The peak's ages shaded, the curve, the season's age as a dashed line labelled with its phase on the
 * top two rows, and the peak's dot labelled right above it: nothing of the curve rises past its peak,
 * so no line crosses that label.
 */
const ChartMarks = ({ chart }: { chart: CurveChart }) => {
  const { plot, points, peak, now, plateau } = chart;
  return (
    <>
      <rect
        className="plateau"
        x={plateau.left}
        y={plot.top}
        width={plateau.right - plateau.left}
        height={plot.bottom - plot.top}
      />
      {now === undefined ? null : (
        <g className="now">
          <line x1={now.x} x2={now.x} y1={plot.top} y2={plot.bottom} />
          {[TEXT.card.curveNowMark(now.age), TEXT.card.curvePhases[chart.phase]].map(
            (label, row) => (
              <text
                key={label}
                x={now.x}
                y={plot.top - GAP - (2 - row) * LABEL_LINE}
                textAnchor={edgeAnchor(now.x, plot)}
              >
                {label}
              </text>
            ),
          )}
        </g>
      )}
      <polyline
        className="curve"
        points={points.map(({ x, y }) => `${String(x)},${String(y)}`).join(" ")}
      />
      <g className="peak">
        <circle cx={peak.x} cy={peak.y} r={GAP / 2 + 1} />
        <text x={peak.x} y={peak.y - GAP} textAnchor={edgeAnchor(peak.x, plot)}>
          {TEXT.card.curvePeakMark(peak.age, peak.value)}
        </text>
      </g>
    </>
  );
};

/** Every age with the curve's value, for screen readers. */
const ChartTable = ({ chart }: { chart: CurveChart }) => (
  <table className="visually-hidden">
    <caption>{TEXT.card.curve}</caption>
    <thead>
      <tr>
        <th scope="col">{TEXT.card.curveAge}</th>
        <th scope="col">{TEXT.card.curveValue}</th>
      </tr>
    </thead>
    <tbody>
      {chart.points.map(({ age, value }) => (
        <tr key={age}>
          <th scope="row">{age}</th>
          <td>{formatNumber(value)}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * The curve with labelled axes and its marks, drawn for the eye only; the peak and his age as facts
 * under it, and the data in a table for screen readers.
 */
const CurveFigure = ({ chart }: { chart: CurveChart }): JSX.Element => {
  const { peak, now, plateau } = chart;
  return (
    <figure className="curve-chart">
      {/* The level's title above the chart rather than turned along its axis: readable, with its "?". */}
      <div className="heading-help">
        <span className="axis-title">{TEXT.card.curveValue}</span>
        <FieldHelp label={TEXT.card.curveValue} text={HELP_TEXT.curveLevel} />
      </div>
      <svg viewBox={chart.viewBox} aria-hidden="true">
        <ChartAxes chart={chart} />
        <ChartMarks chart={chart} />
      </svg>
      <figcaption>
        <Facts
          facts={[
            [TEXT.card.curvePeakLabel, TEXT.card.curvePoint(peak.age, peak.value)],
            [TEXT.card.curvePlateauLabel, TEXT.card.curvePlateau(plateau.from, plateau.to)],
            ...(now === undefined
              ? []
              : [[TEXT.card.curveNowLabel, TEXT.card.curvePoint(now.age, now.value)] as const]),
            [TEXT.card.curvePhaseLabel, TEXT.card.curvePhases[chart.phase], HELP_TEXT.curvePhase],
          ]}
        />
      </figcaption>
      <ChartTable chart={chart} />
    </figure>
  );
};

/** The small curve as a button that opens the large chart over the card. */
export const CurveButton = ({
  name,
  line,
  chart,
}: {
  name: string;
  line: Sparkline;
  chart: CurveChart;
}): JSX.Element => {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useCallback(() => button.current, []);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="curve-button"
        aria-haspopup="dialog"
        aria-label={TEXT.card.showCurve(name)}
        onClick={() => {
          setOpen(true);
        }}
      >
        <CurveSparkline line={line} />
      </button>
      {open ? (
        <ModalDialog
          title={TEXT.card.curveTitle(name)}
          className="curve"
          returnFocus={returnFocus}
          onClose={() => {
            setOpen(false);
          }}
        >
          <CurveFigure chart={chart} />
        </ModalDialog>
      ) : null}
    </>
  );
};
