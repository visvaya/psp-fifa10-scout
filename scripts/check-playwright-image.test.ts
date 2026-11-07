import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAYWRIGHT_WORKFLOWS, checkPlaywrightImage } from "./check-playwright-image.ts";

const DIGEST = `sha256:${"a".repeat(64)}`;
const FILE = ".github/workflows/example.yml";
const workflow = (image: string) => `jobs:\n  e2e:\n    container:\n      image: ${image}\n`;

describe("checkPlaywrightImage", () => {
  it("passes when the image carries the installed Playwright version and a digest", () => {
    expect(
      checkPlaywrightImage(
        FILE,
        workflow(`mcr.microsoft.com/playwright:v1.64.1-noble@${DIGEST}`),
        "1.64.1",
      ),
    ).toBeNull();
  });

  it("asks for the matching image in the named workflow when Playwright moves on", () => {
    const problem = checkPlaywrightImage(
      FILE,
      workflow(`mcr.microsoft.com/playwright:v1.64.1-noble@${DIGEST}`),
      "1.65.0",
    );
    expect(problem).toContain("v1.64.1");
    expect(problem).toContain(`set the image in ${FILE} to`);
    expect(problem).toContain("v1.65.0-noble");
  });

  it("rejects an image pinned by tag alone", () => {
    expect(
      checkPlaywrightImage(FILE, workflow("mcr.microsoft.com/playwright:v1.64.1-noble"), "1.64.1"),
    ).toContain("digest");
  });

  it("checks every Playwright image, not only the first", () => {
    const twoJobs =
      workflow(`mcr.microsoft.com/playwright:v1.64.1-noble@${DIGEST}`) +
      "  other:\n    container:\n      image: mcr.microsoft.com/playwright:v1.64.1-noble\n";
    expect(checkPlaywrightImage(FILE, twoJobs, "1.64.1")).toContain("digest");
  });

  it("reports a workflow without the image", () => {
    expect(checkPlaywrightImage(FILE, "jobs: {}\n", "1.64.1")).toContain(FILE);
  });

  it.each(PLAYWRIGHT_WORKFLOWS)("finds the image in %s", (file) => {
    const problem = checkPlaywrightImage(file, readFileSync(file, "utf8"), "0.0.0");
    expect(problem).toContain(`set the image in ${file} to`);
    expect(problem).toContain("v0.0.0-noble");
  });

  it("covers the web vitals workflow, which runs in the same image", () => {
    expect(PLAYWRIGHT_WORKFLOWS).toContain(".github/workflows/web-vitals.yml");
  });
});
