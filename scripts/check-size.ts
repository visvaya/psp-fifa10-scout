// Fails when the production build grows past its budget: JavaScript and CSS (gzip, as served), the service
// worker, everything the worker stores for offline use (precache, bytes on the device), and the sample
// screenshots of the start page (WebP files, which stay out of the precache).
//
// Usage: node scripts/check-size.ts [dist directory]  (after pnpm build; it never builds)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { precacheOfDirectory, SCREENSHOT_DIRECTORY } from "./write-service-worker.ts";

interface BuildSizes {
  readonly jsGzipBytes: number;
  readonly cssGzipBytes: number;
  readonly serviceWorkerBytes: number;
  readonly precacheBytes: number;
  readonly screenshotBytes: number;
}

// Fixed ceilings for a tool of this kind, set on 2026-11-04 with room to grow, not raised per
// change: JavaScript under the 170 KB gzip often given for pages fast on a mid-range phone, the rest in
// proportion. Measured then: JS gzip 115 021, CSS gzip 3 031, worker 10 569, precache 398 276 bytes. A
// change that crosses one needs a decision on the cause, not a higher number. The screenshots' ceiling was
// set on 2026-11-05 about 20 % over the three files then (184 896 bytes in total).
const SIZE_BUDGETS: BuildSizes = {
  jsGzipBytes: 160 * 1024,
  cssGzipBytes: 8 * 1024,
  serviceWorkerBytes: 16 * 1024,
  precacheBytes: 600 * 1024,
  screenshotBytes: 216 * 1024,
};

const SIZE_KEYS = [
  "jsGzipBytes",
  "cssGzipBytes",
  "serviceWorkerBytes",
  "precacheBytes",
  "screenshotBytes",
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
    screenshotBytes: readdirSync(path.join(distDir, SCREENSHOT_DIRECTORY)).reduce(
      (sum, file) => sum + statSync(path.join(distDir, SCREENSHOT_DIRECTORY, file)).size,
      0,
    ),
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
