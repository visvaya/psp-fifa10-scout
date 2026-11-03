// Writes dist/sw.js: the service worker that keeps this release of the app for offline use. Its source is
// service-worker-template.js (next to this file); this step writes the list of the release's files, each
// with its SHA-256, into the template's placeholder.
//
// Usage: node scripts/write-service-worker.ts [dist directory]
// Runs after the bundler (pnpm build). Nothing here depends on the time of the run, so the same build gives
// the same worker, and a build that changes no file keeps the worker the users already have.
//
// URLs are relative to the worker, which sits next to index.html, so one build works at the site root and
// under a sub-path (Vite `base: "./"`).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const SERVICE_WORKER_FILE = "sw.js";
const START_PAGE_FILE = "index.html";
// Host rules the host reads and never serves (a file the server answers with 404 fails every install), and
// the worker itself, which the browser fetches on its own.
const NOT_PRECACHED_FILES = new Set([
  "_headers",
  "_redirects",
  ".assetsignore",
  SERVICE_WORKER_FILE,
]);
const RELEASE_PLACEHOLDER = "self.APP_RELEASE_PLACEHOLDER";
/** One prefix per app on the origin: a shared origin (user.github.io) shares its cache storage. */
export const CACHE_PREFIX = "psp-fifa10-scout-";
const CACHE_ID_LENGTH_CHARS = 16;
const TEMPLATE_FILE = path.join(import.meta.dirname, "service-worker-template.js");

export interface PrecacheEntry {
  readonly url: string;
  readonly sha256: string;
}

export const sha256Hex = (content: string | Uint8Array): string =>
  createHash("sha256").update(content).digest("hex");

// Source maps: only developer tools ask for them, and a host may not serve them at all.
const isPrecached = (filePath: string): boolean =>
  !NOT_PRECACHED_FILES.has(filePath) && !filePath.endsWith(".map");

/**
 * What the worker keeps: every file the browser can ask for, sorted by path, relative to the worker. The
 * start page is fetched as the directory itself, which is how the app is opened.
 */
export const precacheOf = (
  files: readonly { readonly path: string; readonly sha256: string }[],
): PrecacheEntry[] =>
  files
    .filter((file) => isPrecached(file.path))
    .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((file) => ({
      url: file.path === START_PAGE_FILE ? "./" : `./${file.path}`,
      sha256: file.sha256,
    }));

/** The release's cache, named after the kept files, so two releases never share one. */
export const cacheIdOf = (precache: readonly PrecacheEntry[]): string =>
  sha256Hex(JSON.stringify(precache)).slice(0, CACHE_ID_LENGTH_CHARS);

/** The worker of one release: the template with the release written into its placeholder. */
export const renderServiceWorker = (
  template: string,
  precache: readonly PrecacheEntry[],
): string => {
  const parts = template.split(RELEASE_PLACEHOLDER);
  if (parts.length !== 2) {
    throw new Error(
      `the worker's source must name ${RELEASE_PLACEHOLDER} exactly once, found ${String(parts.length - 1)}`,
    );
  }
  const release = { cachePrefix: CACHE_PREFIX, cacheId: cacheIdOf(precache), precache };
  return parts.join(JSON.stringify(release, null, 2));
};

export const readTemplate = (): string => readFileSync(TEMPLATE_FILE, "utf8");

const listFiles = (dir: string, prefix = ""): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative) : [relative];
  });

/** The files a build directory's worker keeps, as written into its sw.js. */
export const precacheOfDirectory = (distDir: string): PrecacheEntry[] =>
  precacheOf(
    listFiles(distDir).map((file) => ({
      path: file,
      sha256: sha256Hex(readFileSync(path.join(distDir, file))),
    })),
  );

const main = (distDir: string): number => {
  if (!existsSync(path.join(distDir, START_PAGE_FILE))) {
    console.error(
      `write-service-worker: no ${START_PAGE_FILE} in ${distDir}; run the bundler first.`,
    );
    return 1;
  }
  // Left over from an earlier run on the same directory.
  rmSync(path.join(distDir, SERVICE_WORKER_FILE), { force: true });
  const precache = precacheOfDirectory(distDir);
  writeFileSync(
    path.join(distDir, SERVICE_WORKER_FILE),
    renderServiceWorker(readTemplate(), precache),
  );
  console.log(`write-service-worker: ${String(precache.length)} files kept for offline use`);
  return 0;
};

if (import.meta.main) {
  process.exitCode = main(path.resolve(process.argv[2] ?? "dist"));
}
