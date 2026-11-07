// Lab measurement of Core Web Vitals on the production build, with Playwright's Chromium only: LCP, CLS,
// a TBT stand-in for INP (long tasks past the first contentful paint) and the bytes transferred. Two
// pages, each measured RUNS times on a phone viewport with the CPU slowed, medians reported: the start
// screen on a first visit (a fresh context), and the player list as a returning user sees it (the
// synthetic game stored by an earlier visit opens the list directly).
//
// Advisory: a median past its "good" boundary is reported as a warning (scripts/web-vitals-summary.ts),
// never a failure. Only a run that measures nothing fails. Shared CI runners make the millisecond
// values noisy.
//
// Usage: pnpm measure:web-vitals  (builds first; needs `pnpm exec playwright install chromium` once)
// Output: reports/web-vitals/ (summary.md, summary.json)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { preview } from "vite";
import { formatSummary, readRun, summarize } from "./web-vitals-summary.ts";
import type { LabRun, SummaryRow } from "./web-vitals-summary.ts";
import { SYNTHETIC_DB_PATH } from "./write-synthetic-db.ts";

const OUTPUT_DIR = path.join("reports", "web-vitals");
const PREVIEW_PORT = 4198;
const RUNS = 3;
/** CPU slowdown, as DevTools' "4x" preset for a mid-range phone. */
const CPU_SLOWDOWN = 4;
/** After the page is ready: time for late shifts and tasks to be recorded. */
const SETTLE_MS = 1000;
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true } as const;

/** Runs in the page before its own scripts: records LCP, layout shifts and long tasks as they happen. */
const record = () => {
  const vitals: {
    lcpMs: number | null;
    shifts: { startMs: number; value: number }[];
    longTasks: { startMs: number; durationMs: number }[];
  } = { lcpMs: null, shifts: [], longTasks: [] };
  Reflect.set(window, "__vitals", vitals);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) vitals.lcpMs = entry.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // A shift right after input is expected and does not count (web.dev, CLS).
      if (Reflect.get(entry, "hadRecentInput") !== true) {
        vitals.shifts.push({
          startMs: entry.startTime,
          value: Number(Reflect.get(entry, "value")),
        });
      }
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      vitals.longTasks.push({ startMs: entry.startTime, durationMs: entry.duration });
    }
  }).observe({ type: "longtask", buffered: true });
};

/** Runs in the page once it is ready: the recorded values, the first contentful paint and the bytes. */
const collect = (): unknown => {
  const vitals: unknown = Reflect.get(window, "__vitals");
  if (typeof vitals !== "object" || vitals === null) return null;
  const fcp = performance.getEntriesByName("first-contentful-paint")[0];
  const transferBytes = [
    ...performance.getEntriesByType("navigation"),
    ...performance.getEntriesByType("resource"),
  ].reduce(
    (sum, entry) => sum + (entry instanceof PerformanceResourceTiming ? entry.transferSize : 0),
    0,
  );
  Reflect.set(vitals, "fcpMs", fcp?.startTime ?? null);
  Reflect.set(vitals, "transferBytes", transferBytes);
  return vitals;
};

/** One visit of the page in the context, slowed down, until the page shows what `ready` waits for. */
const measureVisit = async (
  context: BrowserContext,
  url: string,
  ready: (page: Page) => Promise<void>,
): Promise<LabRun> => {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(SETTLE_MS);
  const run = readRun(await page.evaluate(collect));
  await page.close();
  return run;
};

const startReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>("#game-file")?.disabled === false,
  );
};

const listReady = async (page: Page): Promise<void> => {
  await page.getByRole("table").or(page.locator(".phone-list")).first().waitFor();
};

/** Opens the list once with the synthetic game, so the stored game opens it on the next visit. */
const storeGame = async (context: BrowserContext, url: string): Promise<void> => {
  const page = await context.newPage();
  await page.goto(url);
  await startReady(page);
  await page.getByLabel("Wybierz obraz ISO lub fifa.db").setInputFiles(SYNTHETIC_DB_PATH);
  await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
  // The reload proves the game is stored: only the stored game opens the list directly.
  await page.reload();
  await listReady(page);
  await page.close();
};

const measurePage = async (
  page: string,
  measureOnce: () => Promise<LabRun>,
): Promise<SummaryRow[]> => {
  // One run after another, chained: a run needs the CPU to itself.
  const runs = await Array.from({ length: RUNS }).reduce<Promise<LabRun[]>>(
    async (done) => [...(await done), await measureOnce()],
    Promise.resolve([]),
  );
  return summarize(page, runs);
};

/** A fresh context each run: a first visit, nothing stored, nothing cached. */
const firstVisit = async (browser: Browser, url: string): Promise<LabRun> => {
  const context = await browser.newContext(PHONE);
  await context.addInitScript(record);
  try {
    return await measureVisit(context, url, startReady);
  } finally {
    await context.close();
  }
};

if (import.meta.main) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = await preview({ preview: { port: PREVIEW_PORT, strictPort: true } });
  const browser = await chromium.launch();
  try {
    const url = `http://localhost:${String(PREVIEW_PORT)}/`;
    const start = await measurePage("start", async () => firstVisit(browser, url));
    // One context for the list runs: the game is stored once and every run is a returning visit.
    const returning = await browser.newContext(PHONE);
    await storeGame(returning, url);
    await returning.addInitScript(record);
    const list = await measurePage("list", async () => measureVisit(returning, url, listReady));
    await returning.close();
    const rows = [...start, ...list];
    const summary = formatSummary(rows, { runs: RUNS, cpuSlowdown: CPU_SLOWDOWN });
    writeFileSync(path.join(OUTPUT_DIR, "summary.md"), summary);
    writeFileSync(path.join(OUTPUT_DIR, "summary.json"), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(summary);
    for (const row of rows.filter((item) => item.warn)) {
      console.log(
        `::warning title=Web vitals::${row.page}: ${row.name} ${String(row.value)} ${row.unit}`,
      );
    }
  } finally {
    await browser.close();
    await server.close();
  }
}
