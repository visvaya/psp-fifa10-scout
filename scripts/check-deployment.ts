// Checks what the host serves after a deploy: the same release as the local build (the worker and every
// file it keeps, byte for byte), the response headers from public/_headers, a worker browsers revalidate,
// nothing that blocks indexing, a canonical address of the site itself, and a 404 for a missing asset.
//
// Usage: node scripts/check-deployment.ts <site URL> [dist directory]  (after the deploy; it never builds)
// Retries for a while: a fresh deploy can take a few seconds to reach every location.
import { readFileSync } from "node:fs";
import path from "node:path";
import { precacheOfDirectory, sha256Hex } from "./write-service-worker.ts";
import type { PrecacheEntry } from "./write-service-worker.ts";

const ATTEMPTS = 6;
const RETRY_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MISSING_ASSET_PATH = "assets/missing-asset-check.js";

export interface Expected {
  readonly siteUrl: string;
  readonly serviceWorker: string;
  readonly precache: readonly PrecacheEntry[];
  /** Header names in lower case. */
  readonly headers: Readonly<Record<string, string>>;
  /** As built; the precache check proves the host serves the same bytes. */
  readonly robotsTxt: string;
  readonly sitemapXml: string;
}

export interface Served {
  readonly serviceWorker: { readonly body: string; readonly cacheControl: string | null };
  /** Header names in lower case. */
  readonly startPage: { readonly headers: Readonly<Record<string, string>>; readonly html: string };
  /** By precache URL. */
  readonly files: ReadonlyMap<string, { readonly status: number; readonly sha256: string }>;
  readonly missingAssetStatus: number;
}

/** The headers of the `/*` block of a `_headers` file, names in lower case. */
export const headersForAllPaths = (text: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  let inAllPaths = false;
  for (const line of text.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      inAllPaths = line.trim() === "/*";
      continue;
    }
    const colon = line.indexOf(":");
    if (inAllPaths && colon > 0) {
      headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
    }
  }
  return headers;
};

const attributeOf = (html: string, pattern: RegExp): string | null =>
  pattern.exec(html)?.[1] ?? null;

const indexingProblems = (expected: Expected, served: Served): string[] => {
  const { headers, html } = served.startPage;
  const robotsHeader = headers["x-robots-tag"] ?? "";
  const robotsMeta = attributeOf(html, /<meta\s+name="robots"\s+content="([^"]*)"/i) ?? "";
  const canonical = attributeOf(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  return [
    ...(/noindex/i.test(robotsHeader)
      ? [`start page X-Robots-Tag ${robotsHeader} blocks indexing`]
      : []),
    ...(/noindex/i.test(robotsMeta)
      ? [`start page meta robots ${robotsMeta} blocks indexing`]
      : []),
    ...(canonical === expected.siteUrl
      ? []
      : [`canonical ${canonical ?? "(missing)"}, expected ${expected.siteUrl}`]),
    // One group for every crawler; a bare "Disallow: /" shuts the whole site.
    ...(/^\s*disallow:\s*\/\s*$/im.test(expected.robotsTxt)
      ? ["robots.txt disallows the whole site"]
      : []),
    ...(expected.sitemapXml.includes(`<loc>${expected.siteUrl}</loc>`)
      ? []
      : [`sitemap.xml does not list ${expected.siteUrl}`]),
  ];
};

export const findDeploymentProblems = (expected: Expected, served: Served): string[] => {
  if (served.serviceWorker.body !== expected.serviceWorker) {
    return ["sw.js differs from the build: another release is served"];
  }
  const cacheControl = served.serviceWorker.cacheControl ?? "(missing)";
  return [
    ...expected.precache.flatMap((entry) => {
      const file = served.files.get(entry.url);
      if (file === undefined || file.status !== 200) {
        return [`${entry.url}: HTTP ${String(file?.status ?? "not requested")}`];
      }
      return file.sha256 === entry.sha256
        ? []
        : [`${entry.url}: SHA-256 ${file.sha256}, built ${entry.sha256}`];
    }),
    ...Object.entries(expected.headers).flatMap(([name, value]) => {
      const actual = served.startPage.headers[name];
      return actual === value
        ? []
        : [`header ${name}: ${actual ?? "(missing)"}, expected ${value}`];
    }),
    ...(/no-cache|max-age=0/.test(cacheControl)
      ? []
      : [`sw.js Cache-Control ${cacheControl} lets browsers skip updates`]),
    ...indexingProblems(expected, served),
    ...(served.missingAssetStatus === 404
      ? []
      : [`a missing asset answers HTTP ${String(served.missingAssetStatus)}, expected 404`]),
  ];
};

const get = async (url: URL): Promise<Response> =>
  fetch(url, { cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

const fetchServed = async (
  siteUrl: string,
  precache: readonly PrecacheEntry[],
): Promise<Served> => {
  const worker = await get(new URL("sw.js", siteUrl));
  const start = await get(new URL(siteUrl));
  const startHtml = await start.text();
  const files = new Map(
    await Promise.all(
      precache.map(async (entry) => {
        const response = await get(new URL(entry.url, siteUrl));
        const sha256 = sha256Hex(new Uint8Array(await response.arrayBuffer()));
        return [entry.url, { status: response.status, sha256 }] as const;
      }),
    ),
  );
  const missing = await get(new URL(MISSING_ASSET_PATH, siteUrl));
  await missing.body?.cancel();
  return {
    serviceWorker: { body: await worker.text(), cacheControl: worker.headers.get("cache-control") },
    startPage: { headers: Object.fromEntries(start.headers), html: startHtml },
    files,
    missingAssetStatus: missing.status,
  };
};

/** The problems of the last attempt; each retry waits, so a fresh deploy can reach every location. */
const checkWithRetries = async (expected: Expected, attemptsLeft: number): Promise<string[]> => {
  // A timeout or a reset connection is retried like any other problem.
  const problems = await fetchServed(expected.siteUrl, expected.precache).then(
    (served) => findDeploymentProblems(expected, served),
    (error: unknown) => [`request failed: ${String(error)}`],
  );
  if (problems.length === 0 || attemptsLeft <= 1) return problems;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return checkWithRetries(expected, attemptsLeft - 1);
};

const main = async (siteUrl: string, distDir: string): Promise<number> => {
  const expected: Expected = {
    siteUrl,
    serviceWorker: readFileSync(path.join(distDir, "sw.js"), "utf8"),
    precache: precacheOfDirectory(distDir),
    headers: headersForAllPaths(readFileSync(path.join(distDir, "_headers"), "utf8")),
    robotsTxt: readFileSync(path.join(distDir, "robots.txt"), "utf8"),
    sitemapXml: readFileSync(path.join(distDir, "sitemap.xml"), "utf8"),
  };
  const problems = await checkWithRetries(expected, ATTEMPTS);
  if (problems.length === 0) {
    console.log(
      `check-deployment: ${siteUrl} serves the build (${String(expected.precache.length)} files)`,
    );
    return 0;
  }
  console.error(`check-deployment: ${siteUrl}\n${problems.map((p) => `  ${p}`).join("\n")}`);
  return 1;
};

if (import.meta.main) {
  const [siteUrl, distDir = "dist"] = process.argv.slice(2);
  if (siteUrl === undefined) {
    console.error("Usage: node scripts/check-deployment.ts <site URL> [dist directory]");
    process.exitCode = 1;
  } else {
    process.exitCode = await main(siteUrl, path.resolve(distDir));
  }
}
