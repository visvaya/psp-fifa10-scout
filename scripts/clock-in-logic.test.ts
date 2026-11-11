import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSync, Visitor } from "oxc-parser";
import type { CallExpression, NewExpression } from "oxc-parser";
import { describe, expect, it } from "vitest";

// oxlint forbids Date.now in logic and data, but it has no rule for a bare `new Date()` or `Date()`,
// which read the clock just the same; this test closes that gap. It reads the syntax tree, so comments
// and strings do not count and a call split over lines does.
const LAYERS = ["src/logic", "src/data"];

const sourcesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/u.test(path))
    .map((path) => join(dir, path));

/** The lines where the source calls Date with no arguments, with or without `new`. */
const clockReadsIn = (path: string, source: string): readonly number[] => {
  const lines: number[] = [];
  const check = (call: CallExpression | NewExpression) => {
    if (
      call.callee.type === "Identifier" &&
      call.callee.name === "Date" &&
      call.arguments.length === 0
    )
      lines.push(source.slice(0, call.start).split("\n").length);
  };
  new Visitor({ CallExpression: check, NewExpression: check }).visit(
    parseSync(path, source).program,
  );
  return lines;
};

describe("logic and data layers", () => {
  it.each([
    ["new Date()", [1]],
    ["const at = Date();", [1]],
    ["const at =\n  new Date(\n  );", [2]],
    ["new Date(/* now */);", [1]],
    ['new Date("2009-01-01");\nnew Date(year, 0, 1);', []],
    ["a.toDate(); isoDate();", []],
    ['// new Date()\nconst text = "new Date()";', []],
  ] as const)("finds the clock read in %j", (source, lines) => {
    expect(clockReadsIn("case.ts", source)).toEqual(lines);
  });

  it("never read the clock: pass the time in as a parameter", () => {
    const offenders = LAYERS.flatMap(sourcesUnder).flatMap((path) =>
      clockReadsIn(path, readFileSync(path, "utf8")).map((line) => `${path}:${String(line)}`),
    );
    expect(offenders).toEqual([]);
  });
});
