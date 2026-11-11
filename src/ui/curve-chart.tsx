import { useCallback, useRef, useState } from "react";
import type { CSSProperties, JSX, RefCallback } from "react";
import type { CurveChart } from "../logic/curve-chart.ts";
import type { Sparkline } from "../logic/curve-sparkline.ts";
import { CurveSparkline } from "./curve-sparkline.tsx";
import { FieldHelp } from "./field-help.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { formatNumber, TEXT } from "./text.ts";
import { HELP_TEXT } from "./text-help.ts";

/** Room in viewBox units between a label and its axis, a mark or the chart's edge. */
const GAP = 6;
const LABEL_LINE = 14;

/** The level's title turned along the y axis, its middle at the plot's: x and y in viewBox units. */
const levelTitleAt = (plot: CurveChart["plot"]) => ({
  x: GAP + LABEL_LINE / 2,
  y: (plot.top + plot.bottom) / 2,
});

/**
 * Grid lines at the value ticks, the ticks' labels, both axes, the ages' title, and the level's title
 * turned along its axis, as charts set it (owner, 2026-11-11).
 */
const ChartAxes = ({
  chart: { plot, valueTicks, ageTicks },
  level,
  levelRef,
}: {
  chart: CurveChart;
  level: string;
  levelRef: RefCallback<SVGTextElement>;
}) => (
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
      ref={levelRef}
      className="axis-title"
      x={levelTitleAt(plot).x}
      y={levelTitleAt(plot).y}
      transform={`rotate(-90 ${String(levelTitleAt(plot).x)} ${String(levelTitleAt(plot).y)})`}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {level}
    </text>
  </>
);

/** Half the size of the season's mark on the curve: a diamond, unlike the peak's round dot. */
const NOW_MARK = 5;

/**
 * The peak's ages shaded, the season's age as a dashed line with a diamond where it meets the curve,
 * the curve, and the peak's dot. Nothing is labelled on the chart: the legend under it names each mark.
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
        <line className="now" x1={now.x} x2={now.x} y1={plot.top} y2={plot.bottom} />
      )}
      <polyline
        className="curve"
        points={points.map(({ x, y }) => `${String(x)},${String(y)}`).join(" ")}
      />
      <circle className="peak" cx={peak.x} cy={peak.y} r={GAP / 2 + 1} />
      {now === undefined ? null : (
        <path
          className="now-mark"
          d={`M${String(now.x)},${String(now.y - NOW_MARK)}l${String(NOW_MARK)},${String(NOW_MARK)}l${String(-NOW_MARK)},${String(NOW_MARK)}l${String(-NOW_MARK)},${String(-NOW_MARK)}z`}
        />
      )}
    </>
  );
};

/** What the chart's y measures: his OVR with a career, the curve's relative level without one. */
const levelName = (chart: CurveChart): string =>
  chart.kind === "ovr" ? TEXT.card.curveOvr : TEXT.card.curveValue;

/**
 * Every age with the chart's value, for screen readers. Hidden by a wrapper: a table keeps its rows'
 * height whatever height it is given, and iOS Safari let a dialog scroll through it.
 */
const ChartTable = ({ chart }: { chart: CurveChart }) => (
  <div className="visually-hidden">
    <table>
      <caption>{TEXT.card.curve}</caption>
      <thead>
        <tr>
          <th scope="col">{TEXT.card.curveAge}</th>
          <th scope="col">{levelName(chart)}</th>
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
  </div>
);

/** A legend item's sample of its mark, drawn as on the chart. */
const LegendMark = ({ kind }: { kind: "now" | "plateau" | "peak" }) => (
  <svg className="legend-mark" viewBox="0 0 24 16" aria-hidden="true">
    {kind === "now" ? (
      <>
        <line className="now" x1={12} x2={12} y1={0} y2={16} />
        <path className="now-mark" d="M12,3l5,5l-5,5l-5,-5z" />
      </>
    ) : kind === "plateau" ? (
      <rect className="plateau" x={2} y={1} width={20} height={14} />
    ) : (
      <circle className="peak" cx={12} cy={8} r={4} />
    )}
  </svg>
);

/** Each mark of the chart named once: the season's age and phase, the peak's ages, the peak. */
const ChartLegend = ({ chart }: { chart: CurveChart }) => {
  const { peak, now, plateau, kind } = chart;
  return (
    <ul className="chart-legend">
      {now === undefined ? null : (
        <li>
          <LegendMark kind="now" />
          <span className="legend-words">
            {TEXT.card.legendNow(
              now.age,
              TEXT.card.curvePhases[chart.phase],
              kind === "ovr" ? now.value : null,
            )}
          </span>
        </li>
      )}
      <li>
        <LegendMark kind="plateau" />
        <span className="legend-words">
          {TEXT.card.legendPlateau(plateau.from, plateau.to)}
          <FieldHelp
            label={TEXT.card.legendPlateau(plateau.from, plateau.to)}
            text={HELP_TEXT.curvePhase}
          />
        </span>
      </li>
      <li>
        <LegendMark kind="peak" />
        <span className="legend-words">
          {TEXT.card.legendPeak(peak.age, peak.value, kind === "ovr")}
        </span>
      </li>
    </ul>
  );
};

/** Half the "?"'s height past the level's title, in viewBox units: the glyph at 13 units of text. */
const HELP_HALF = 7;

/**
 * Where the level's "?" goes over the chart, in shares of its box: on the turned title's line, just past
 * its top end, read as the word after it. Until the title is measured the "?" sits at its middle.
 */
const useLevelHelpPlace = (chart: CurveChart) => {
  const [length, setLength] = useState(0);
  // Measured whenever the title's box changes: a closed dialog draws nothing, so the first measure, before
  // it opens, is 0 in WebKit.
  const levelRef = useCallback((title: SVGTextElement | null) => {
    if (title === null) return undefined;
    const observer = new ResizeObserver(() => {
      setLength(title.getComputedTextLength());
    });
    observer.observe(title);
    return () => {
      observer.disconnect();
    };
  }, []);
  const [, , width, height] = chart.viewBox.split(" ").map(Number);
  const at = levelTitleAt(chart.plot);
  const place: CSSProperties = {
    left: `${String((at.x / (width ?? 1)) * 100)}%`,
    top: `${String(((at.y - length / 2 - GAP - HELP_HALF) / (height ?? 1)) * 100)}%`,
  };
  return { levelRef, place };
};

/**
 * The chart with its level's title along the axis and its "?" past the title, the legend under it, and
 * the data in a table for screen readers.
 */
const CurveFigure = ({ chart }: { chart: CurveChart }): JSX.Element => {
  const level = levelName(chart);
  const { levelRef, place } = useLevelHelpPlace(chart);
  return (
    <figure className="curve-chart">
      <div className="chart-plot">
        <svg viewBox={chart.viewBox} aria-hidden="true">
          <ChartAxes chart={chart} level={level} levelRef={levelRef} />
          <ChartMarks chart={chart} />
        </svg>
        {/* A button cannot sit in the hidden svg: it goes over it, where the title ends. */}
        <span className="level-help" style={place}>
          <FieldHelp
            label={level}
            text={chart.kind === "ovr" ? HELP_TEXT.ovrLevel : HELP_TEXT.curveLevel}
          />
        </span>
      </div>
      <figcaption>
        <ChartLegend chart={chart} />
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
