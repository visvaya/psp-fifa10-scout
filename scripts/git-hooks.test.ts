import { describe, expect, it } from "vitest";
import { commitMessageProblems, isOwnerIdentity } from "./git-hooks.ts";

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

  // git keeps comment lines with -m and -F, so a commented trailer would reach the history.
  it("rejects a commented co-author line", () => {
    const trailer = ["# Co", "authored-by: A <a@b.c>"].join("-");
    expect(commitMessageProblems(`fix: x\n\n${trailer}\n`)).toHaveLength(1);
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
