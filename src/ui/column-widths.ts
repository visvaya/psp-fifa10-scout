// Column widths for the virtual table, from every row's text rather than the drawn rows, so they stay
// put while the list scrolls or the filters change.

export interface WidthInput<Row, Column> {
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly label: (column: Column) => string;
  /** The cell's text, or null for a rating cell, whose width is ratingPx; either with besidePx. */
  readonly text: (row: Row, column: Column) => string | null;
  /**
   * What a cell draws beside its value, in px: the best peak's position beside the badges, the stars
   * before a name, or 0.
   */
  readonly besidePx: (column: Column, row: Row) => number;
  /** Pixel widths of a cell text and of a header label in their fonts. */
  readonly measureText: (text: string) => number;
  readonly measureLabel: (text: string) => number;
  /** Header padding and sort mark; cell padding. */
  readonly labelExtraPx: number;
  readonly cellExtraPx: number;
  readonly ratingPx: number;
}

/** Each column's width in whole pixels: its widest value or its label, whichever is wider. */
export const columnWidths = <Row, Column>(input: WidthInput<Row, Column>): readonly number[] =>
  input.columns.map((column) => {
    // Each text measured once, however many rows share it.
    const measured = new Map<string | null, number>();
    const widthOf = (value: string | null): number => {
      const known = measured.get(value);
      if (known !== undefined) return known;
      const width = value === null ? input.ratingPx : input.measureText(value);
      measured.set(value, width);
      return width;
    };
    const content = input.rows.reduce(
      (widest, row) =>
        Math.max(widest, widthOf(input.text(row, column)) + input.besidePx(column, row)),
      0,
    );
    return Math.ceil(
      Math.max(
        input.measureLabel(input.label(column)) + input.labelExtraPx,
        content + input.cellExtraPx,
      ),
    );
  });
