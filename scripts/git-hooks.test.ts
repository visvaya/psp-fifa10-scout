import { describe, expect, it } from "vitest";
import { commitMessageProblems, hasAbsolutePath, isOwnerIdentity } from "./git-hooks.ts";

describe("commitMessageProblems", () => {
  it("accepts a plain conventional message", () => {
    expect(commitMessageProblems("feat(ui): add player table\n\nBody line.\n")).toEqual([]);
  });

  it("rejects co-author trailers in any case", () => {
    expect(commitMessageProblems("fix: x\n\nco-authored-by: Someone <a@b.c>")).toHaveLength(1);
  });

  it("rejects generated-by lines", () => {
    expect(commitMessageProblems("fix: x\n\nGenerated with some tool")).toHaveLength(1);
  });

  it("ignores comment lines that git strips", () => {
    expect(commitMessageProblems("fix: x\n# Co-authored-by: hint")).toEqual([]);
  });
});

describe("isOwnerIdentity", () => {
  it("matches the owner's noreply e-mail case-insensitively", () => {
    expect(isOwnerIdentity("visvaya <84781703+Visvaya@users.noreply.github.com> 1 +0100")).toBe(
      true,
    );
  });

  it("rejects any other e-mail", () => {
    expect(isOwnerIdentity("Someone <someone@example.com> 1 +0100")).toBe(false);
  });
});

// Built from pieces so this file does not trip the pre-commit check it tests.
const QUOTED_WINDOWS_PATH = ['"', "C:", "\\data", '"'].join("");

describe("hasAbsolutePath", () => {
  it("finds a Windows path in a code file", () => {
    expect(hasAbsolutePath("src/a.ts", `const p = ${QUOTED_WINDOWS_PATH};`)).toBe(true);
  });

  it("ignores documentation", () => {
    expect(hasAbsolutePath("README.md", QUOTED_WINDOWS_PATH)).toBe(false);
  });
});
