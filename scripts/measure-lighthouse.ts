// Lab audit of the production build with Lighthouse (mobile profile, its default): performance, LCP, CLS,
// TBT (the lab stand-in for INP), total bytes, accessibility and best practices. Two pages, each measured
// RUNS times with the median reported: the start screen on a first visit (storage cleared), and the player
// list as a returning user sees it (the synthetic game stored by an earlier visit opens the list directly).
//
// Advisory: a value Lighthouse scores below 0.9 is reported as a warning (scripts/lighthouse-summary.ts),
// never a failure. Only a run that measures nothing fails. Shared CI runners make the millisecond values
// noisy.
//
// Usage: pnpm measure:lighthouse  (builds first; needs `pnpm exec playwright install chromium` once)
// Output: reports/lighthouse/ (an HTML report per run, summary.md, summary.json)
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import lighthouse from "lighthouse";
import type { Flags } from "lighthouse";
import { preview } from "vite";
import { formatSummary, readRun, summarize } from "./lighthouse-summary.ts";
import type { LabRun, SummaryRow } from "./lighthouse-summary.ts";
import { SYNTHETIC_DB_PATH } from "./write-synthetic-db.ts";

const OUTPUT_DIR = path.join("reports", "lighthouse");
const PROFILE_DIR = path.join("reports", "lighthouse-profile");
const PREVIEW_PORT = 4198;
const DEBUGGING_PORT = 9223;
const RUNS = 3;

/** Opens the list once with the synthetic game, so the stored game opens it on the next visit. */
const storeGame = async (context: BrowserContext, url: string): Promise<void> => {
  const page = await context.newPage();
  await page.goto(url);
  const input = page.getByLabel("Wybierz obraz ISO lub fifa.db");
  await page.waitForFunction(
    () => document.querySelector<HTMLInputElement>("#game-file")?.disabled === false,
  );
  await input.setInputFiles(SYNTHETIC_DB_PATH);
  await page.getByRole("button", { name: /^Pokaż zawodników/u }).click();
  // The reload proves the game is stored: only the stored game opens the list directly.
  await page.reload();
  await page.getByRole("table").or(page.locator(".phone-list")).first().waitFor();
  await page.close();
};

const audit = async (url: string, name: string, flags: Flags): Promise<LabRun> => {
  const result = await lighthouse(url, {
    ...flags,
    port: DEBUGGING_PORT,
    output: "html",
    logLevel: "error",
  });
  if (result === undefined) throw new Error(`Lighthouse returned nothing for ${name}`);
  const { lhr, report } = result;
  if (lhr.runtimeError !== undefined) throw new Error(`${name}: ${lhr.runtimeError.message}`);
  writeFileSync(path.join(OUTPUT_DIR, `${name}.html`), String(report));
  return readRun(lhr);
};

const measurePage = async (
  page: string,
  measureOnce: (name: string) => Promise<LabRun>,
): Promise<SummaryRow[]> => {
  // One run after another, chained: Lighthouse needs the browser to itself.
  const runs = await Array.from(
    { length: RUNS },
    (_, index) => `${page}-${String(index + 1)}`,
  ).reduce<Promise<LabRun[]>>(
    async (done, name) => [...(await done), await measureOnce(name)],
    Promise.resolve([]),
  );
  return summarize(page, runs);
};

if (import.meta.main) {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  rmSync(PROFILE_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const server = await preview({ preview: { port: PREVIEW_PORT, strictPort: true } });
  // The persistent context is the browser's default one, where Lighthouse opens its tab, so the game
  // stored here is the one Lighthouse's visit finds. New headless Chromium, as Lighthouse expects.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chromium",
    args: [`--remote-debugging-port=${String(DEBUGGING_PORT)}`],
  });
  try {
    const url = `http://localhost:${String(PREVIEW_PORT)}/`;
    const start = await measurePage("start", async (name) => audit(url, name, {}));
    // Stored once: the list runs keep the storage, so each one finds the game.
    await storeGame(context, url);
    const list = await measurePage("list", async (name) =>
      audit(url, name, { disableStorageReset: true }),
    );
    const rows = [...start, ...list];
    const summary = formatSummary(rows, RUNS);
    writeFileSync(path.join(OUTPUT_DIR, "summary.md"), summary);
    writeFileSync(path.join(OUTPUT_DIR, "summary.json"), `${JSON.stringify(rows, null, 2)}\n`);
    console.log(summary);
    for (const row of rows.filter((item) => item.warn)) {
      console.log(
        `::warning title=Lighthouse::${row.page}: ${row.name} scores ${row.score.toFixed(2)}`,
      );
    }
  } finally {
    await context.close();
    await server.close();
    rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}
