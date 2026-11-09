import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MAX_TITLE_CHARS, shortTitle } from "./dependabot-title.ts";

describe("shortTitle", () => {
  it("keeps a title that fits", () => {
    const title = "build(deps-dev): bump the dev group with 3 updates";
    expect(shortTitle(title)).toBe(title);
  });

  it("drops the group first", () => {
    // 83 characters (pull request #141); without the group it fits.
    expect(
      shortTitle(
        "build(deps): bump @tanstack/react-virtual from 3.14.24 to 3.14.25 in the prod group",
      ),
    ).toBe("build(deps): bump @tanstack/react-virtual from 3.14.24 to 3.14.25");
  });

  it("then the version it updates from, only when the group was not enough", () => {
    expect(
      shortTitle(
        "build(deps-dev): bump wrangler from 4.156.0 to 4.156.1 in /deploy in the deploy group",
      ),
    ).toBe("build(deps-dev): bump wrangler from 4.156.0 to 4.156.1 in /deploy");
    // 81 characters without the group.
    expect(
      shortTitle(
        "build(deps): bump @tanstack/react-virtual-extended-name from 13.14.24 to 13.14.25 in the prod group",
      ),
    ).toBe("build(deps): bump @tanstack/react-virtual-extended-name to 13.14.25");
  });

  it("leaves a title it cannot bring within the limit as it is", () => {
    const title = `build(deps): bump ${"a".repeat(70)} from 1.0.0 to 1.0.1 in the prod group`;
    expect(shortTitle(title)).toBe(title);
  });

  it("holds to commitlint's header length", () => {
    const config = readFileSync("commitlint.config.mjs", "utf8");
    expect(config).toContain(`"header-max-length": [2, "always", ${String(MAX_TITLE_CHARS)}]`);
  });
});
