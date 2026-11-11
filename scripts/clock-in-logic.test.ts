import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// oxlint forbids Date.now in logic and data, but it has no rule for a bare `new Date()` or
// `Date()`, which read the clock just the same; this test closes that gap.
const LAYERS = ["src/logic", "src/data"];
const READS_CLOCK = /(?<![\w.])(?:new\s+)?Date\s*\(\s*\)/u;

const sourcesUnder = (dir: string): readonly string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.tsx?$/u.test(path))
    .map((path) => join(dir, path));

const clockReadsIn = (source: string): readonly number[] =>
  source.split("\n").flatMap((line, index) => (READS_CLOCK.test(line) ? [index + 1] : []));

describe("logic and data layers", () => {
  it.each([
    ["new Date()", [1]],
    ["const at = Date();", [1]],
    ['new Date("2009-01-01");\nnew Date(year, 0, 1);', []],
    ["a.toDate(); isoDate();", []],
  ] as const)("finds the clock read in %j", (source, lines) => {
    expect(clockReadsIn(source)).toEqual(lines);
  });

  it("never read the clock: pass the time in as a parameter", () => {
    const offenders = LAYERS.flatMap(sourcesUnder).flatMap((path) =>
      clockReadsIn(readFileSync(path, "utf8")).map((line) => `${path}:${String(line)}`),
    );
    expect(offenders).toEqual([]);
  });
});
