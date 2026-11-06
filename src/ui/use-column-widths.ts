import { useLayoutEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { columnWidths } from "./column-widths.ts";
import type { WidthInput } from "./column-widths.ts";

type Metrics = Pick<
  WidthInput<unknown, unknown>,
  "measureText" | "measureLabel" | "labelExtraPx" | "cellExtraPx" | "ratingPx"
>;

const px = (value: string): number => Number.parseFloat(value) || 0;

const fontOf = (element: Element): string => {
  const style = getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
};

const paddingOf = (element: Element): number => {
  const style = getComputedStyle(element);
  return px(style.paddingLeft) + px(style.paddingRight);
};

/**
 * Text widths in the table's own fonts, read once it is drawn with a row; null before that. A table
 * drawn without a rating column has no rating to measure, and gives it no width.
 */
const readMetrics = (table: HTMLTableElement): Metrics | null => {
  const context = document.createElement("canvas").getContext("2d");
  const [header, label, mark, cell, rating] = [
    "thead th",
    ".sort-button",
    ".sort-mark",
    "tbody tr[aria-rowindex] td",
    ".rating",
  ].map((selector) => table.querySelector(selector));
  if (!context || !header || !label || !mark || !cell) return null;
  const measure = (font: string) => (text: string) => {
    context.font = font;
    return context.measureText(text).width;
  };
  return {
    measureText: measure(fontOf(cell)),
    measureLabel: measure(fontOf(label)),
    labelExtraPx: paddingOf(header) + mark.getBoundingClientRect().width,
    cellExtraPx: paddingOf(cell),
    ratingPx: rating?.getBoundingClientRect().width ?? 0,
  };
};

type WidthSource<Row, Column> = Pick<
  WidthInput<Row, Column>,
  "rows" | "columns" | "label" | "text" | "besidePx"
> & {
  readonly table: RefObject<HTMLTableElement | null>;
  /** The table shows a row, so its fonts and paddings can be read. */
  readonly drawn: boolean;
};

/**
 * The table's column widths from every row, null until the first drawn row is measured. `columns`,
 * `label`, `text` and `besidePx` must be stable between renders, or the widths are computed again. A
 * table measured without a rating is measured again once its columns change, so a rating column shown
 * later gets the rating's width; once a rating is measured, never again.
 */
export const useColumnWidths = <Row, Column>({
  table,
  drawn,
  ...source
}: WidthSource<Row, Column>): readonly number[] | null => {
  const { rows, columns, label, text, besidePx } = source;
  const [measured, setMeasured] = useState<{
    metrics: Metrics;
    columns: readonly Column[];
  } | null>(null);
  useLayoutEffect(() => {
    if (!drawn || table.current === null) return;
    if (measured !== null && (measured.metrics.ratingPx > 0 || measured.columns === columns))
      return;
    // Measuring layout before paint is what a layout effect is for; the first widths never show.
    const metrics = readMetrics(table.current);
    // oxlint-disable-next-line react/set-state-in-effect -- runs when the first row is drawn, and again only after the columns change while no rating was measured
    if (metrics !== null) setMeasured({ metrics, columns });
  }, [measured, drawn, table, columns]);
  const metrics = measured?.metrics ?? null;
  return useMemo(
    () =>
      metrics === null ? null : columnWidths({ ...metrics, columns, rows, label, text, besidePx }),
    [metrics, columns, rows, label, text, besidePx],
  );
};
