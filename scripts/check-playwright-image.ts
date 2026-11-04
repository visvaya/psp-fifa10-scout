// Checks that the browser tests' container image in CI carries the installed Playwright version and is
// pinned by digest. The image holds the browsers and their system packages; a test runner of another
// version looks for browsers the image does not have. Dependabot bumps @playwright/test but not the image,
// so this check fails that update with the steps to follow.
// Usage: node scripts/check-playwright-image.ts
// Exit codes: 0 the image matches, 1 it does not or cannot be found.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export const CI_WORKFLOW = ".github/workflows/ci.yml";

const IMAGE =
  /^\s*image:\s*mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble(@sha256:[0-9a-f]{64})?\s*$/gm;

/**
 * Null when every Playwright image in the workflow matches the installed version and has a digest;
 * otherwise what to do.
 */
export const checkPlaywrightImage = (workflow: string, installed: string): string | null => {
  const images = [...workflow.matchAll(IMAGE)];
  if (images.length === 0) return `no mcr.microsoft.com/playwright image found in ${CI_WORKFLOW}`;
  const tag = `v${installed}-noble`;
  const bump =
    `set the image in ${CI_WORKFLOW} to mcr.microsoft.com/playwright:${tag}@<digest>, the digest from ` +
    `curl -sI -H "Accept: application/vnd.oci.image.index.v1+json" ` +
    `https://mcr.microsoft.com/v2/playwright/manifests/${tag} (header Docker-Content-Digest)`;
  const problems = images.map(([, version, digest]) => {
    if (version !== installed) {
      return `the CI image has Playwright v${version ?? "?"}, the project ${installed}: ${bump}`;
    }
    return digest === undefined
      ? `the CI image is pinned by tag only, add its digest: ${bump}`
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
  const problem = checkPlaywrightImage(readFileSync(CI_WORKFLOW, "utf8"), version);
  if (problem !== null) process.stderr.write(`${problem}\n`);
  process.exitCode = problem === null ? 0 : 1;
}
/* v8 ignore stop */
