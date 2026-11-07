// The summary of a Lighthouse lab audit (scripts/measure-lighthouse.ts): the values read from each run, their
// medians and the job summary table. Pure, so its tests do not load Lighthouse.

/** Lighthouse colours a score from 0.9 up green; below that the summary warns. */
const WARN_BELOW_SCORE = 0.9;

const CATEGORIES = ["performance", "accessibility", "best-practices"] as const;
const AUDITS = [
  ["largest-contentful-paint", "LCP", "ms"],
  ["cumulative-layout-shift", "CLS", ""],
  ["total-blocking-time", "TBT", "ms"],
  ["total-byte-weight", "Total bytes", "B"],
] as const;

/** One measured value: Lighthouse's 0-1 score for it, and the raw number for an audit. */
interface Measured {
  readonly score: number;
  readonly value?: number;
}

/** The part of Lighthouse's result the summary reads. */
interface LabResult {
  readonly categories: Readonly<Record<string, { readonly score: number | null } | undefined>>;
  readonly audits: Readonly<
    Record<string, { readonly score: number | null; readonly numericValue?: number } | undefined>
  >;
}

export type LabRun = Readonly<Record<string, Measured>>;

export interface SummaryRow {
  readonly page: string;
  readonly name: string;
  readonly score: number;
  readonly value?: number;
  readonly unit: string;
  readonly warn: boolean;
}

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
};

/** The values of one run, failing on a category or audit Lighthouse could not score. */
export const readRun = (lhr: LabResult): LabRun => {
  const run: Record<string, Measured> = {};
  for (const id of CATEGORIES) {
    const score = lhr.categories[id]?.score;
    if (typeof score !== "number") throw new Error(`Lighthouse did not score ${id}`);
    run[id] = { score };
  }
  for (const [id] of AUDITS) {
    const { score, numericValue } = lhr.audits[id] ?? {};
    if (typeof score !== "number" || numericValue === undefined) {
      throw new Error(`Lighthouse did not measure ${id}`);
    }
    run[id] = { score, value: numericValue };
  }
  return run;
};

/** The median of each value over a page's runs, with a warning where the median score is not green. */
export const summarize = (page: string, runs: readonly LabRun[]): SummaryRow[] => {
  const of = (id: string) => runs.map((run) => run[id]).filter((item) => item !== undefined);
  const row = (id: string, name: string, unit: string): SummaryRow => {
    const score = median(of(id).map((item) => item.score));
    const values = of(id).flatMap((item) => (item.value === undefined ? [] : [item.value]));
    const base = { page, name, score, unit, warn: score < WARN_BELOW_SCORE };
    return values.length === 0 ? base : { ...base, value: median(values) };
  };
  return [
    ...CATEGORIES.map((id) => row(id, id, "")),
    ...AUDITS.map(([id, name, unit]) => row(id, name, unit)),
  ];
};

const formatValue = ({ value, unit }: SummaryRow): string => {
  if (value === undefined) return "";
  if (unit === "") return value.toFixed(3);
  return `${String(Math.round(value))} ${unit}`;
};

/** The job summary: a Markdown table of the medians. */
export const formatSummary = (rows: readonly SummaryRow[], runs: number): string =>
  [
    `### Lighthouse (advisory, mobile profile, median of ${String(runs)} runs)`,
    "",
    "| Page | Measure | Median | Score | |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.page} | ${row.name} | ${formatValue(row)} | ${row.score.toFixed(2)} | ${row.warn ? "warn" : "ok"} |`,
    ),
    "",
    `"warn": Lighthouse scores the median below ${String(WARN_BELOW_SCORE)}. Reported, not enforced.`,
    "",
  ].join("\n");
