// Checks that the Playwright container image in every CI workflow that runs one carries the installed
// Playwright version and is pinned by digest. The image holds the browsers and their system packages; a test runner of another
// version looks for browsers the image does not have. Dependabot bumps @playwright/test but not the image,
// so this check fails that update with the steps to follow.
// Usage: node scripts/check-playwright-image.ts
// Exit codes: 0 the image matches, 1 it does not or cannot be found.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/** The workflows that run in the Playwright image: the browser tests and the web vitals measurement. */
export const PLAYWRIGHT_WORKFLOWS = [
  ".github/workflows/ci.yml",
  ".github/workflows/web-vitals.yml",
] as const;

const IMAGE =
  /^\s*image:\s*mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble(@sha256:[0-9a-f]{64})?\s*$/gm;

/**
 * Null when every Playwright image in the workflow file matches the installed version and has a digest;
 * otherwise what to do.
 */
export const checkPlaywrightImage = (
  file: string,
  workflow: string,
  installed: string,
): string | null => {
  const images = [...workflow.matchAll(IMAGE)];
  if (images.length === 0) return `no mcr.microsoft.com/playwright image found in ${file}`;
  const tag = `v${installed}-noble`;
  const bump =
    `set the image in ${file} to mcr.microsoft.com/playwright:${tag}@<digest>, the digest from ` +
    `curl -sI -H "Accept: application/vnd.oci.image.index.v1+json" ` +
    `https://mcr.microsoft.com/v2/playwright/manifests/${tag} (header Docker-Content-Digest)`;
  const problems = images.map(([, version, digest]) => {
    if (version !== installed) {
      return `${file}: the image has Playwright v${version ?? "?"}, the project ${installed}: ${bump}`;
    }
    return digest === undefined
      ? `${file}: the image is pinned by tag only, add its digest: ${bump}`
      : null;
  });
  return problems.find((problem) => problem !== null) ?? null;
};

/* v8 ignore start -- process glue */
if (import.meta.main) {
  const manifest = createRequire(import.meta.url).resolve("@playwright/test/package.json");
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const version =
    typeof parsed === "object" && parsed !== null && "version" in parsed
      ? String(parsed.version)
      : "";
  const problems = PLAYWRIGHT_WORKFLOWS.flatMap((file) => {
    const problem = checkPlaywrightImage(file, readFileSync(file, "utf8"), version);
    return problem === null ? [] : [problem];
  });
  for (const problem of problems) process.stderr.write(`${problem}\n`);
  process.exitCode = problems.length === 0 ? 0 : 1;
}
/* v8 ignore stop */
