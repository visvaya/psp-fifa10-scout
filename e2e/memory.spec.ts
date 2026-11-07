import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { SYNTHETIC_DB_PATH, SYNTHETIC_SAVE_PATHS } from "../scripts/write-synthetic-db.ts";
import { expect, expectCount, loadCareer, test } from "./support.ts";

/**
 * How much the page may grow over the warmed-up baseline after the cycles, each of which loads the game
 * and the save. Measured on 2026-11-07 over three runs of 6 cycles after 3 warm-up cycles: listeners
 * and nodes grew by 0, the heap by 365 to 434 KB, almost all of it compiled code and the browser's
 * performance entries, not the app's objects. The heap budget is about twice the largest growth; the
 * listener and node budgets stay below one leaked listener per load and one leaked files screen (200
 * nodes).
 */
const MEMORY_BUDGET = {
  warmUpCycles: 3,
  cycles: 6,
  heapGrowthBytes: 900_000,
  listenerGrowthCount: 5,
  nodeGrowthCount: 50,
} as const;

/**
 * Picks files on a file input from inside the page. setInputFiles keeps a DevTools handle to every input
 * it fills, which holds each closed files screen in memory and would read as a leak of the app.
 */
const pickInPage = async (page: Page, inputId: string, paths: readonly string[]) => {
  await expect(page.locator(`#${inputId}`)).toBeEnabled();
  const files = paths.map((file) => ({
    name: path.basename(file),
    base64: readFileSync(file).toString("base64"),
  }));
  await page.evaluate(
    ([id, picked]) => {
      const input = document.getElementById(id);
      if (!(input instanceof HTMLInputElement)) throw new Error(`no file input #${id}`);
      const transfer = new DataTransfer();
      for (const { name, base64 } of picked) {
        const bytes = Uint8Array.from(atob(base64), (char) => char.codePointAt(0) ?? 0);
        transfer.items.add(new File([bytes], name));
      }
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [inputId, files] as const,
  );
};

/** Loads the game and the career again from the files screen, opens and closes a card, filters. */
const runCycle = async (page: Page) => {
  await page.getByRole("button", { name: "Pliki" }).click();
  await pickInPage(page, "game-file", [SYNTHETIC_DB_PATH]);
  await pickInPage(page, "save-file", SYNTHETIC_SAVE_PATHS);
  await page.getByRole("button", { name: "Pokaż zawodników (62)" }).click();
  const search = page.getByRole("searchbox", { name: "Nazwisko" });
  await search.fill("messi");
  await page.getByRole("button", { name: "Lionel Messi" }).click();
  const card = page.getByRole("dialog", { name: "Lionel Messi" });
  await expect(card).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await search.fill("");
  const goalkeepers = page.getByRole("checkbox", { name: "Bramkarz" });
  await goalkeepers.check();
  await expect(page.locator("p.count")).not.toHaveText("62 zawodników");
  await goalkeepers.uncheck();
  await expectCount(page, "62 zawodników");
};

/** The cycles one after another: each starts from the screen the previous one left. */
const runCycles = async (page: Page, count: number): Promise<void> => {
  if (count === 0) return;
  await runCycle(page);
  await runCycles(page, count - 1);
};

type Metrics = { heapBytes: number; listeners: number; nodes: number };

/** The page's heap, event listeners and DOM nodes after a forced garbage collection. */
const measure = async (page: Page): Promise<Metrics> => {
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  await session.send("HeapProfiler.collectGarbage");
  const { metrics } = await session.send("Performance.getMetrics");
  await session.detach();
  const metric = (name: string) =>
    metrics.find((entry) => entry.name === name)?.value ?? Number.NaN;
  return {
    heapBytes: metric("JSHeapUsedSize"),
    listeners: metric("JSEventListeners"),
    nodes: metric("Nodes"),
  };
};

test("repeated loads keep the heap, listeners, nodes and workers within budget", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(browserName !== "chromium", "only Chromium measures the heap through DevTools");
  await loadCareer(page);
  // The first cycles compile most of the app's code, which the heap counts.
  await runCycles(page, MEMORY_BUDGET.warmUpCycles);
  const baseline = await measure(page);
  // The app runs one parsing worker for the whole session.
  expect(page.workers()).toHaveLength(1);
  await runCycles(page, MEMORY_BUDGET.cycles);
  const after = await measure(page);
  testInfo.annotations.push({ type: "memory", description: JSON.stringify({ baseline, after }) });
  // Soft checks: a failure names every measure over its budget.
  expect.soft(page.workers()).toHaveLength(1);
  expect
    .soft(after.heapBytes - baseline.heapBytes)
    .toBeLessThanOrEqual(MEMORY_BUDGET.heapGrowthBytes);
  expect
    .soft(after.listeners - baseline.listeners)
    .toBeLessThanOrEqual(MEMORY_BUDGET.listenerGrowthCount);
  expect.soft(after.nodes - baseline.nodes).toBeLessThanOrEqual(MEMORY_BUDGET.nodeGrowthCount);
});
