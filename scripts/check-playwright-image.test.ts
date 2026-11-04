import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CI_WORKFLOW, checkPlaywrightImage } from "./check-playwright-image.ts";

const DIGEST = `sha256:${"a".repeat(64)}`;
const workflow = (image: string) => `jobs:\n  e2e:\n    container:\n      image: ${image}\n`;

describe("checkPlaywrightImage", () => {
  it("passes when the image carries the installed Playwright version and a digest", () => {
    expect(
      checkPlaywrightImage(
        workflow(`mcr.microsoft.com/playwright:v1.64.1-noble@${DIGEST}`),
        "1.64.1",
      ),
    ).toBeNull();
  });

  it("asks for the matching image when Playwright moves on", () => {
    const problem = checkPlaywrightImage(
      workflow(`mcr.microsoft.com/playwright:v1.64.1-noble@${DIGEST}`),
      "1.65.0",
    );
    expect(problem).toContain("v1.64.1");
    expect(problem).toContain("v1.65.0-noble");
  });

  it("rejects an image pinned by tag alone", () => {
    expect(
      checkPlaywrightImage(workflow("mcr.microsoft.com/playwright:v1.64.1-noble"), "1.64.1"),
    ).toContain("digest");
  });

  it("reports a workflow without the image", () => {
    expect(checkPlaywrightImage("jobs: {}\n", "1.64.1")).toContain(CI_WORKFLOW);
  });

  it("finds the image in the real workflow", () => {
    const problem = checkPlaywrightImage(readFileSync(CI_WORKFLOW, "utf8"), "0.0.0");
    expect(problem).toContain("v0.0.0-noble");
  });
});
