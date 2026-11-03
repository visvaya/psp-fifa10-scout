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
export const SIZE_BUDGETS: BuildSizes = {
  jsGzipBytes: 105 * 1024,
  cssGzipBytes: 2.5 * 1024,
  serviceWorkerBytes: 11 * 1024,
  precacheBytes: 364 * 1024,
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
