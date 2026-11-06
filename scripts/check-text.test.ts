import { describe, expect, it } from "vitest";
import { findContentProblems, findFileProblems, findTextProblems } from "./check-text.ts";

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

  // An escape lost on the way into a file (a regex \b written as a backspace) hides in the text.
  it("reports a control character, but not a tab or a carriage return", () => {
    expect(findTextProblems(`/^Name 1${String.fromCodePoint(8)}/u`, "a.ts")).toEqual([
      "a.ts:1: control character U+0008",
    ]);
    expect(findTextProblems("a\tb\r\nc", "a.ts")).toEqual([]);
  });

  it("accepts an en dash, a middle dot and text symbols", () => {
    const text = `a ${EN_DASH} b ${String.fromCodePoint(0xb7)} c ${String.fromCodePoint(0xa9, 0x2192)}`;
    expect(findTextProblems(text, "a.md")).toEqual([]);
  });
});

// Built from pieces so this file passes its own check.
const DRIVE = ["C", ":"].join("");
const PATH_MESSAGE = "absolute local path; use a relative path";

describe("findContentProblems", () => {
  it.each([
    ["a drive path with forward slashes", "a.ts", `const p = "${DRIVE}/data/x";`],
    ["a path in a comment", "a.ts", `// see ${DRIVE}\\Projekty\\x`],
    ["a path inside a longer string", "a.ts", `const arg = "dir=${DRIVE}\\x";`],
    ["a path in a JSON file", "a.json", `{ "root": "${DRIVE}\\\\Projekty" }`],
    ["a Linux home directory", "a.md", `see ${["", "home", "me"].join("/")}`],
    ["a macOS home directory", "a.sh", `cd ${["", "Users", "me"].join("/")}`],
  ])("reports %s", (_name, file, line) => {
    expect(findContentProblems(`ok\n${line}`, file)).toEqual([`${file}:2: ${PATH_MESSAGE}`]);
  });

  it("accepts a URL, a colon between letters and a key before an escape", () => {
    const text =
      "see https://example.com/a and a:b\nconst yaml = `e2e:\\n  run: x`;\nhttps://example.com/home/x";
    expect(findContentProblems(text, "a.ts")).toEqual([]);
  });
});

describe("findFileProblems", () => {
  it("skips the lockfile and missing files", () => {
    expect(findFileProblems("pnpm-lock.yaml")).toEqual([]);
    expect(findFileProblems("does-not-exist.ts")).toEqual([]);
  });
});
