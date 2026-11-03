// Fails when the production build grows past its budget: JavaScript and CSS (gzip, as served), the service
// worker, and everything the worker stores for offline use (precache, bytes on the device).
//
// Usage: node scripts/check-size.ts [dist directory]  (after pnpm build; it never builds)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { precacheOfDirectory } from "./write-service-worker.ts";

export interface BuildSizes {
  readonly jsGzipBytes: number;
  readonly cssGzipBytes: number;
  readonly serviceWorkerBytes: number;
  readonly precacheBytes: number;
}

// Just above the sizes measured on 2026-11-03 (JS 98 206, CSS 2 090, worker 10 316, precache 343 323). A
// budget is raised only by a decision that names the reason, never to make a failing build pass.
// Raised 2026-11-03 for the stage 2 filters (JS 103 970, precache 361 563): their Polish labels for
// traits, ranges and lists and the sectioned panel add about 5.8 kB of gzipped JavaScript.
// Raised 2026-11-03 for the loading states: JS 106 416 -> 106 780, precache 369 667 -> 372 469 (main
// before, the branch after); the list skeleton, the "show players" button and the loaded file names.
// Raised 2026-11-03 for free agents and the phone column labels: precache 372 496 -> 373 626 (JS gzip
// 106 778 -> 107 022, within its budget); the free agent flag and filter, and the labels over the rows.
// Raised 2026-11-03 for stable table columns and closing dialogs from outside: JS 107 022 -> 107 810,
// precache 373 722 -> 375 751; the column widths measured from every player and the backdrop click.
// Raised 2026-11-03 for locking the page behind a dialog on iOS, as Chrome's guidance on scrolling under
// a modal dialog describes (root locked, dialog overscroll contained): CSS gzip 2 556 -> 2 569 (budget
// 2 560 -> 2 600), precache 375 761 -> 375 857.
// Raised 2026-11-03 for remembering the career save and showing what it holds: JS 107 923 -> 108 729,
// precache 376 235 -> 378 573; the stored save, its summary, the forget button and the folder help.
// Raised 2026-11-03 for the "Mój klub" field (all, hide or only the user's club): precache 378 573 ->
// 378 925 (JS gzip 108 926, within its budget).
export const SIZE_BUDGETS: BuildSizes = {
  jsGzipBytes: 107 * 1024,
  cssGzipBytes: 2600,
  serviceWorkerBytes: 11 * 1024,
  precacheBytes: 371 * 1024,
};

const SIZE_KEYS = [
  "jsGzipBytes",
  "cssGzipBytes",
  "serviceWorkerBytes",
  "precacheBytes",
] as const satisfies readonly (keyof BuildSizes)[];

export const findSizeProblems = (sizes: BuildSizes, budgets: BuildSizes): string[] =>
  SIZE_KEYS.filter((key) => sizes[key] > budgets[key]).map(
    (key) => `${key}: ${String(sizes[key])} exceeds the budget of ${String(budgets[key])}`,
  );

const gzipBytesOf = (files: readonly string[]): number =>
  files.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);

const measure = (distDir: string): BuildSizes => {
  const assets = readdirSync(path.join(distDir, "assets")).map((file) =>
    path.join(distDir, "assets", file),
  );
  return {
    jsGzipBytes: gzipBytesOf(assets.filter((file) => file.endsWith(".js"))),
    cssGzipBytes: gzipBytesOf(assets.filter((file) => file.endsWith(".css"))),
    serviceWorkerBytes: statSync(path.join(distDir, "sw.js")).size,
    precacheBytes: precacheOfDirectory(distDir)
      .map((entry) => (entry.url === "./" ? "index.html" : entry.url.slice(2)))
      .reduce((sum, file) => sum + statSync(path.join(distDir, file)).size, 0),
  };
};

if (import.meta.main) {
  const sizes = measure(path.resolve(process.argv[2] ?? "dist"));
  for (const key of SIZE_KEYS) {
    console.log(`${key}: ${String(sizes[key])} (budget ${String(SIZE_BUDGETS[key])})`);
  }
  const problems = findSizeProblems(sizes, SIZE_BUDGETS);
  if (problems.length > 0) {
    console.error(`Size budget exceeded:\n${problems.join("\n")}`);
    process.exitCode = 1;
  }
}
