import { useCallback, useRef, useState } from "react";
import type { JSX } from "react";
import type { CurveChart } from "../logic/curve-chart.ts";
import type { Sparkline } from "../logic/curve-sparkline.ts";
import { CurveSparkline } from "./curve-sparkline.tsx";
import { Facts } from "./facts.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { formatNumber, TEXT } from "./text.ts";

/** Room in viewBox units between a label and its axis, a mark or the chart's edge. */
const GAP = 6;
const LABEL_LINE = 14;

/** Grid lines at the value ticks, the ticks' labels, both axes and their titles. */
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
    <text
      className="axis-title"
      transform={`translate(${String(GAP + LABEL_LINE / 2)} ${String((plot.top + plot.bottom) / 2)}) rotate(-90)`}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {TEXT.card.curveValue}
    </text>
  </>
);

/** The curve, the player's age as a dashed line labelled above the plot, and the peak's dot. */
const ChartMarks = ({ chart: { plot, points, peak, now } }: { chart: CurveChart }) => {
  // The peak's label beside its dot, toward the plot's middle so it stays inside.
  const towardLeft = peak.x > (plot.left + plot.right) / 2;
  const below = peak.y < (plot.top + plot.bottom) / 2;
  return (
    <>
      {now === undefined ? null : (
        <g className="now">
          <line x1={now.x} x2={now.x} y1={plot.top} y2={plot.bottom} />
          <text x={now.x} y={plot.top - GAP} textAnchor="middle">
            {TEXT.card.curveNowMark(now.age)}
          </text>
        </g>
      )}
      <polyline
        className="curve"
        points={points.map(({ x, y }) => `${String(x)},${String(y)}`).join(" ")}
      />
      <g className="peak">
        <circle cx={peak.x} cy={peak.y} r={GAP / 2 + 1} />
        <text
          x={peak.x + (towardLeft ? -GAP : GAP)}
          y={peak.y + (below ? LABEL_LINE : -GAP)}
          textAnchor={towardLeft ? "end" : "start"}
        >
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
  const { peak, now } = chart;
  return (
    <figure className="curve-chart">
      <svg viewBox={chart.viewBox} aria-hidden="true">
        <ChartAxes chart={chart} />
        <ChartMarks chart={chart} />
      </svg>
      <figcaption>
        <Facts
          facts={[
            [TEXT.card.curvePeakLabel, TEXT.card.curvePoint(peak.age, peak.value)],
            ...(now === undefined
              ? []
              : [[TEXT.card.curveNowLabel, TEXT.card.curvePoint(now.age, now.value)] as const]),
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
