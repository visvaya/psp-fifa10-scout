import { describe, expect, it } from "vitest";
import { formatSummary, readRun, summarize } from "./lighthouse-summary.ts";

const lhr = (performance: number, lcpMs: number) => ({
  categories: {
    performance: { score: performance },
    accessibility: { score: 1 },
    "best-practices": { score: 0.96 },
  },
  audits: {
    "largest-contentful-paint": { score: performance, numericValue: lcpMs },
    "cumulative-layout-shift": { score: 1, numericValue: 0.012 },
    "total-blocking-time": { score: 1, numericValue: 40 },
    "total-byte-weight": { score: 1, numericValue: 400_000.4 },
  },
});

describe("readRun", () => {
  it("fails on a category Lighthouse could not score", () => {
    const result = lhr(1, 900);
    expect(() =>
      readRun({ ...result, categories: { ...result.categories, accessibility: { score: null } } }),
    ).toThrow("Lighthouse did not score accessibility");
  });

  it("fails on an audit without a value", () => {
    const result = lhr(1, 900);
    expect(() =>
      readRun({ ...result, audits: { ...result.audits, "total-blocking-time": { score: 1 } } }),
    ).toThrow("Lighthouse did not measure total-blocking-time");
  });
});

describe("summarize", () => {
  const rows = summarize("start", [
    readRun(lhr(0.95, 1200)),
    readRun(lhr(0.7, 4000)),
    readRun(lhr(0.85, 2600)),
  ]);

  it("reports the median of each value and warns only where the median score is below 0.9", () => {
    expect(rows.find((row) => row.name === "performance")).toEqual({
      page: "start",
      name: "performance",
      score: 0.85,
      unit: "",
      warn: true,
    });
    expect(rows.find((row) => row.name === "LCP")).toMatchObject({ value: 2600, warn: true });
    expect(rows.filter((row) => row.warn).map((row) => row.name)).toEqual(["performance", "LCP"]);
  });

  it("averages the two middle values of an even number of runs", () => {
    const even = summarize("list", [readRun(lhr(1, 1000)), readRun(lhr(1, 2000))]);
    expect(even.find((row) => row.name === "LCP")?.value).toBe(1500);
  });

  it("formats the medians as a Markdown table", () => {
    const table = formatSummary(rows, 3);
    expect(table).toContain("median of 3 runs");
    expect(table).toContain("| start | LCP | 2600 ms | 0.85 | warn |");
    expect(table).toContain("| start | CLS | 0.012 | 1.00 | ok |");
    expect(table).toContain("| start | Total bytes | 400000 B | 1.00 | ok |");
    expect(table).toContain("| start | accessibility |  | 1.00 | ok |");
  });
});
