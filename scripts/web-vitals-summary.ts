// The summary of the lab measurement of Core Web Vitals (scripts/measure-web-vitals.ts): one run's values
// from what the page recorded, their medians and the job summary table. Pure, so it is tested alone.

/** The "good" boundaries on web.dev (LCP, CLS) and in Lighthouse (TBT); a median above one warns. */
const WARN_ABOVE = { lcpMs: 2500, cls: 0.1, tbtMs: 200 } as const;

/** Layout shifts closer together than this belong to one session window (web.dev, CLS). */
const SESSION_GAP_MS = 1000;
/** A session window ends this long after its first shift at the latest. */
const SESSION_MAX_MS = 5000;
/** The part of a long task past this counts as blocking (Lighthouse's TBT definition). */
const BLOCKING_AFTER_MS = 50;

export interface LabRun {
  readonly lcpMs: number;
  readonly cls: number;
  readonly tbtMs: number;
  readonly transferBytes: number;
}

interface Shift {
  readonly startMs: number;
  readonly value: number;
}

interface LongTask {
  readonly startMs: number;
  readonly durationMs: number;
}

export interface SummaryRow {
  readonly page: string;
  readonly name: string;
  readonly value: number;
  readonly unit: string;
  /** The boundary a value above warns at; none for the bytes. */
  readonly warnAbove?: number;
  readonly warn: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const numberAt = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`the page did not report ${key}`);
  }
  return value;
};

const listAt = <T>(
  record: Record<string, unknown>,
  key: string,
  read: (item: Record<string, unknown>) => T,
): T[] => {
  const value = record[key];
  if (!Array.isArray(value)) throw new Error(`the page did not report ${key}`);
  return value.map((item: unknown) => {
    if (!isRecord(item)) throw new Error(`the page reported a malformed entry in ${key}`);
    return read(item);
  });
};

/** CLS as the largest session window: shifts at most 1 s apart, a window at most 5 s long. */
const clsOf = (shifts: readonly Shift[]): number => {
  let largest = 0;
  let open = { firstMs: Number.NEGATIVE_INFINITY, lastMs: Number.NEGATIVE_INFINITY, sum: 0 };
  for (const shift of shifts.toSorted((a, b) => a.startMs - b.startMs)) {
    const joins =
      shift.startMs - open.lastMs < SESSION_GAP_MS && shift.startMs - open.firstMs < SESSION_MAX_MS;
    open = joins
      ? { ...open, lastMs: shift.startMs, sum: open.sum + shift.value }
      : { firstMs: shift.startMs, lastMs: shift.startMs, sum: shift.value };
    largest = Math.max(largest, open.sum);
  }
  return largest;
};

/**
 * The TBT stand-in, as Lighthouse counts it: of each long task, the part after the first contentful
 * paint, less 50 ms. A task that starts before the paint counts with its remainder.
 */
const tbtOf = (tasks: readonly LongTask[], fcpMs: number): number =>
  tasks.reduce((sum, task) => {
    const afterPaintMs = task.startMs + task.durationMs - Math.max(task.startMs, fcpMs);
    return sum + Math.max(0, afterPaintMs - BLOCKING_AFTER_MS);
  }, 0);

/** One run's values from what the page recorded (`page.evaluate` output, so checked here). */
export const readRun = (raw: unknown): LabRun => {
  if (!isRecord(raw)) throw new Error("the page reported nothing");
  const shifts = listAt(raw, "shifts", (item) => ({
    startMs: numberAt(item, "startMs"),
    value: numberAt(item, "value"),
  }));
  const tasks = listAt(raw, "longTasks", (item) => ({
    startMs: numberAt(item, "startMs"),
    durationMs: numberAt(item, "durationMs"),
  }));
  return {
    lcpMs: numberAt(raw, "lcpMs"),
    cls: clsOf(shifts),
    tbtMs: tbtOf(tasks, numberAt(raw, "fcpMs")),
    transferBytes: numberAt(raw, "transferBytes"),
  };
};

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
};

/** The median of each value over a page's runs, with a warning where it is past its boundary. */
export const summarize = (page: string, runs: readonly LabRun[]): SummaryRow[] => {
  const row = (key: keyof LabRun, name: string, unit: string, warnAbove?: number): SummaryRow => {
    const value = median(runs.map((run) => run[key]));
    const base = { page, name, value, unit, warn: warnAbove !== undefined && value > warnAbove };
    return warnAbove === undefined ? base : { ...base, warnAbove };
  };
  return [
    row("lcpMs", "LCP", "ms", WARN_ABOVE.lcpMs),
    row("cls", "CLS", "", WARN_ABOVE.cls),
    row("tbtMs", "TBT (long tasks after FCP)", "ms", WARN_ABOVE.tbtMs),
    row("transferBytes", "Transferred", "B"),
  ];
};

const formatNumber = (value: number, unit: string): string =>
  unit === "" ? value.toFixed(3) : `${String(Math.round(value))} ${unit}`;

/** The job summary: a Markdown table of the medians and what the numbers mean. */
export const formatSummary = (
  rows: readonly SummaryRow[],
  conditions: { readonly runs: number; readonly cpuSlowdown: number },
): string =>
  [
    `### Core Web Vitals, lab (advisory, median of ${String(conditions.runs)} runs)`,
    "",
    "| Page | Measure | Median | Good up to | |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.page} | ${row.name} | ${formatNumber(row.value, row.unit)} | ${
          row.warnAbove === undefined ? "" : formatNumber(row.warnAbove, row.unit)
        } | ${row.warn ? "warn" : "ok"} |`,
    ),
    "",
    `Chromium with the CPU slowed ${String(conditions.cpuSlowdown)}x and a phone viewport, no network ` +
      "throttling (local server). CLS: the largest session window. TBT: of each long task, the part after " +
      "the first contentful paint less 50 ms, as recorded when collection runs, a second after the page is " +
      "ready; a stand-in for INP. " +
      '"warn" is reported, never enforced. Accessibility is covered by axe in the e2e tests.',
    "",
  ].join("\n");
