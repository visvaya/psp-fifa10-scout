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
  "rows" | "columns" | "label" | "text"
> & {
  readonly table: RefObject<HTMLTableElement | null>;
  /** The table shows a row, so its fonts and paddings can be read. */
  readonly drawn: boolean;
};

/**
 * The table's column widths from every row, null until the first drawn row is measured. `columns`,
 * `label` and `text` must be stable between renders, or the widths are computed again.
 */
export const useColumnWidths = <Row, Column>({
  table,
  drawn,
  ...source
}: WidthSource<Row, Column>): readonly number[] | null => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  useLayoutEffect(() => {
    if (metrics !== null || !drawn || table.current === null) return;
    // Measuring layout before paint is what a layout effect is for; the first widths never show.
    // oxlint-disable-next-line react/set-state-in-effect -- runs once, when the first row is drawn
    setMetrics(readMetrics(table.current));
  }, [metrics, drawn, table]);
  const { rows, columns, label, text } = source;
  return useMemo(
    () => (metrics === null ? null : columnWidths({ ...metrics, columns, rows, label, text })),
    [metrics, columns, rows, label, text],
  );
};
