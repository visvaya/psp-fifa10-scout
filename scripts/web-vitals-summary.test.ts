import { describe, expect, it } from "vitest";
import { formatSummary, readRun, summarize } from "./web-vitals-summary.ts";

const sample = (overrides: Record<string, unknown> = {}) => ({
  lcpMs: 1200,
  fcpMs: 800,
  shifts: [],
  longTasks: [],
  transferBytes: 400_000,
  ...overrides,
});

const run = (lcpMs: number) => ({ lcpMs, cls: 0.01, tbtMs: 40, transferBytes: 400_000 });

describe("readRun", () => {
  it("fails when the page reported no LCP", () => {
    expect(() => readRun(sample({ lcpMs: null }))).toThrow("the page did not report lcpMs");
  });

  it("fails on a malformed entry", () => {
    expect(() => readRun(sample({ shifts: [3] }))).toThrow("malformed entry in shifts");
    expect(() => readRun(null)).toThrow("the page reported nothing");
  });

  it("takes CLS from the largest session window", () => {
    const shifts = [
      // One window: each shift within 1 s of the last.
      [100, 0.02],
      [900, 0.03],
      // A gap over 1 s opens a second, larger window.
      [2500, 0.04],
      [3000, 0.04],
      // 3800, 4600 ... 7000 ms.
      ...Array.from({ length: 5 }, (_, index) => [3800 + 800 * index, 0.01]),
      // Within 1 s of the last shift but over 5 s after the window's first: a third window.
      [7600, 0.05],
    ].map(([startMs, value]) => ({ startMs, value }));
    expect(readRun(sample({ shifts })).cls).toBeCloseTo(0.13);
    expect(readRun(sample()).cls).toBe(0);
  });

  it("counts the blocking part of long tasks from the first contentful paint", () => {
    const longTasks = [
      // Over before the first contentful paint (800 ms): nothing counts.
      { startMs: 100, durationMs: 300 },
      // Straddles it: 200 ms of it after the paint, 150 ms blocking.
      { startMs: 500, durationMs: 500 },
      { startMs: 800, durationMs: 120 },
      { startMs: 1500, durationMs: 50 },
      { startMs: 2000, durationMs: 90 },
    ];
    expect(readRun(sample({ longTasks })).tbtMs).toBe(260);
  });
});

describe("readRun, first list row", () => {
  it("reads the first row's paint time when the page reported one", () => {
    expect(readRun(sample({ firstRowMs: 900 })).firstRowMs).toBe(900);
    expect(readRun(sample({ firstRowMs: null })).firstRowMs).toBeUndefined();
    expect(() => readRun(sample({ firstRowMs: "soon" }))).toThrow("did not report firstRowMs");
  });
});

describe("summarize", () => {
  const rows = summarize("start", [run(1200), run(4000), run(2600)]);

  it("reports the median of each value and warns past the good boundary", () => {
    expect(rows[0]).toEqual({
      page: "start",
      name: "LCP",
      value: 2600,
      unit: "ms",
      warnAbove: 2500,
      warn: true,
    });
    expect(rows.filter((row) => row.warn).map((row) => row.name)).toEqual(["LCP"]);
  });

  it("averages the two middle values of an even number of runs", () => {
    expect(summarize("list", [run(1000), run(2000)])[0]?.value).toBe(1500);
  });

  it("reports the first list row in place of LCP on the list, with no good boundary", () => {
    const list = summarize("list", [
      { ...run(500), firstRowMs: 1800 },
      { ...run(500), firstRowMs: 3000 },
      { ...run(500), firstRowMs: 2000 },
    ]);
    expect(list[0]).toEqual({
      page: "list",
      name: "First list row painted",
      value: 2000,
      unit: "ms",
      warn: false,
    });
    expect(list.map((row) => row.name)).not.toContain("LCP");
  });

  it("formats the medians as a Markdown table", () => {
    const table = formatSummary(rows, { runs: 3, cpuSlowdown: 4 });
    expect(table).toContain("median of 3 runs");
    expect(table).toContain("| start | LCP | 2600 ms | 2500 ms | warn |");
    expect(table).toContain("| start | CLS | 0.010 | 0.100 | ok |");
    expect(table).toContain("| start | Transferred | 400000 B |  | ok |");
    expect(table).toContain("CPU slowed 4x");
    expect(table).toContain("First list row painted:");
  });
});
