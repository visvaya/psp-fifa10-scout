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
// Raised 2026-11-03 for the "Mój klub" field (all, hide or only the user's club): precache 378 806 ->
// 379 158 (JS gzip 108 825 -> 109 024, within its budget).
// Raised 2026-11-03 for position names in the game language (read from its locale files): precache
// 379 676 -> 380 529 (JS gzip 109 112 -> 109 360, within its budget).
// Raised 2026-11-03 for the position groups of the owner's list and the card rows that open to their
// positions: JS gzip 109 360 -> 109 665, CSS gzip 2 587 -> 2 605, precache 380 529 -> 381 818.
// Raised 2026-11-04 for the "~" before a card row whose groups rate differently: precache 381 818 ->
// 382 254.
// Raised 2026-11-04 for position abbreviations in the game's line colours, light and dark: CSS gzip
// 2 605 -> 2 720, precache 382 254 -> 383 126.
// Raised 2026-11-04 for the gain of a position over the OVR (filter, column, card) and the game's full
// position names on the card: JS gzip 110 042 -> 110 653, precache 383 507 -> 384 846.
// Raised 2026-11-04 for the filter sections' open and closed marker (UI audit): CSS gzip 2 709 -> 2 768.
// Raised 2026-11-04 for the header's check for a new version and its messages: precache 385 121 ->
// 386 162.
// Raised 2026-11-04 for the card's gains before the ratings, coloured by sign: CSS gzip 2 790 -> 2 824.
// Raised 2026-11-04 for closing the update check's result and saying what an update keeps: precache
// 386 572 -> 387 219.
// Raised 2026-11-04 for the phone rows' columns of the filtered values, scrolled sideways under a kept
// name: JS gzip 111 432 -> 111 865, CSS gzip 2 831 -> 2 881, precache 387 561 -> 388 735.
// Raised 2026-11-04 for the phone grid's rules moving from style props into styles.css (review): CSS gzip
// 2 881 -> 2 904, precache 389 094 -> 389 121 (with the name's width capped for large text).
// Raised 2026-11-04 for the transfer price and market wage (the game's formulas, their tuning values,
// the price column, card fields, filters and sort): JS gzip 110 042 -> 111 622, precache 383 507 ->
// 387 676; with the position gain above: JS gzip 112 214, precache 389 001; with the update check and
// the UI audit fixes above, and the save's currency: JS gzip 113 115, precache 391 994; with the
// position name and chip fixes (#44, #45): JS gzip 113 218, precache 392 271; with the phone columns
// (#48): JS gzip 113 754, precache 393 860.
// Raised 2026-11-04 for the value each filter chip shows ("Szybkość: od 90"): JS gzip 111 538 -> 112 012,
// precache 387 977 -> 389 553; on top of the transfer price: JS gzip 114 297, precache 395 644.
// Raised 2026-11-04 for the game's shortlist read from the save (mark, filter, card): precache 395 693 ->
// 396 639.
export const SIZE_BUDGETS: BuildSizes = {
  jsGzipBytes: 112 * 1024,
  cssGzipBytes: 2950,
  serviceWorkerBytes: 11 * 1024,
  precacheBytes: 388 * 1024,
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
