// Column widths for the virtual table, from every row's text rather than the drawn rows, so they stay
// put while the list scrolls or the filters change.

export interface WidthInput<Row, Column> {
  readonly columns: readonly Column[];
  readonly rows: readonly Row[];
  readonly label: (column: Column) => string;
  /** The cell's text, or null for a rating cell, whose width is ratingPx. */
  readonly text: (row: Row, column: Column) => string | null;
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
    const values = new Set(input.rows.map((row) => input.text(row, column)));
    const content = Math.max(
      0,
      ...[...values].map((value) => (value === null ? input.ratingPx : input.measureText(value))),
    );
    return Math.ceil(
      Math.max(
        input.measureLabel(input.label(column)) + input.labelExtraPx,
        content + input.cellExtraPx,
      ),
    );
  });
