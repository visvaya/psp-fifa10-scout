import { describe, expect, it } from "vitest";
import { findFileProblems, findTextProblems } from "./check-text.ts";

const EM_DASH = String.fromCodePoint(0x2014);
const EN_DASH = String.fromCodePoint(0x2013);
const SMILE = String.fromCodePoint(0x1f600);

describe("findTextProblems", () => {
  it("reports an em dash with its line number", () => {
    expect(findTextProblems(`ok\nbad ${EM_DASH} here`, "a.ts")).toEqual([
      "a.ts:2: em dash (U+2014); use an en dash (U+2013) or a middle dot (U+00B7)",
    ]);
  });

  it("reports an emoji", () => {
    expect(findTextProblems(`hi ${SMILE}`, "a.md")).toEqual(["a.md:1: emoji"]);
  });

  it("accepts an en dash, a middle dot and text symbols", () => {
    const text = `a ${EN_DASH} b ${String.fromCodePoint(0xb7)} c ${String.fromCodePoint(0xa9, 0x2192)}`;
    expect(findTextProblems(text, "a.md")).toEqual([]);
  });
});

describe("findFileProblems", () => {
  it("skips the lockfile and missing files", () => {
    expect(findFileProblems("pnpm-lock.yaml")).toEqual([]);
    expect(findFileProblems("does-not-exist.ts")).toEqual([]);
  });
});
