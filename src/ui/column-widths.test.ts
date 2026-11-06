import { describe, expect, it } from "vitest";
import { columnWidths } from "./column-widths.ts";

// One pixel per character for cells, two for header labels.
const measures = {
  measureText: (text: string) => text.length,
  measureLabel: (text: string) => text.length * 2,
  labelExtraPx: 3,
  cellExtraPx: 10,
  ratingPx: 7,
  besidePx: () => 0,
};

describe("columnWidths", () => {
  it("fits each column to its widest value or label, whatever rows are drawn", () => {
    const rows: readonly Readonly<Record<string, string>>[] = [
      { name: "Ann", club: "A very long club" },
      { name: "Bartholomew", club: "B" },
    ];
    expect(
      columnWidths({
        ...measures,
        columns: ["name", "club", "overall"],
        rows,
        label: (column) => (column === "overall" ? "OVR" : "X"),
        text: (row, column) => (column === "overall" ? null : (row[column] ?? null)),
      }),
    ).toEqual([
      // name: "Bartholomew" 11 + 10
      21,
      // club: "A very long club" 16 + 10
      26,
      // overall: a rating cell 7 + 10 below the label 3 * 2 + 3
      17,
    ]);
  });

  it("keeps a column as wide as its label when the values are shorter", () => {
    expect(
      columnWidths({
        ...measures,
        columns: ["age"],
        rows: ["7"],
        label: () => "Wiek",
        text: (row) => row,
      }),
    ).toEqual([11]);
  });

  it("adds what a column draws beside its rating badges", () => {
    expect(
      columnWidths({
        ...measures,
        columns: ["overall", "bestPeak"],
        rows: [0],
        label: () => "",
        text: () => null,
        besidePx: (column) => (column === "bestPeak" ? 5 : 0),
      }),
    ).toEqual([
      // overall: a rating 7 + 10
      17,
      // bestPeak: a rating 7, its position 5, + 10
      22,
    ]);
  });

  it("rounds widths up to whole pixels", () => {
    expect(
      columnWidths({
        ...measures,
        measureText: () => 0.2,
        columns: ["x"],
        rows: [0],
        label: () => "",
        text: () => "a",
      }),
    ).toEqual([11]);
  });
});
