// Which lines of a commit message the commit-msg hook reads.
import { describe, expect, it } from "vitest";
import { commitMessageProblems } from "./git-hooks.ts";

const EM_DASH = String.fromCodePoint(0x2014);
const SCISSORS = "# ------------------------ >8 ------------------------";

describe("commitMessageProblems lines", () => {
  // git commit -m and -F keep lines starting with "#", so the hook checks them too.
  it("checks comment lines, which git keeps for -m and -F", () => {
    expect(commitMessageProblems(`fix: x\n# a ${EM_DASH} b`)).toHaveLength(1);
  });

  // git commit -v adds the diff below a scissors line; git cuts it off, so the hook ignores it.
  it("ignores everything below the scissors line", () => {
    expect(commitMessageProblems(`fix: x\n${SCISSORS}\n+a ${EM_DASH} b`)).toEqual([]);
    // core.commentChar may set another character before the scissors.
    expect(commitMessageProblems(`fix: x\n;${SCISSORS.slice(1)}\n+a ${EM_DASH} b`)).toEqual([]);
  });

  it("cuts only at a whole scissors line", () => {
    expect(commitMessageProblems(`fix: x see ${SCISSORS}\n${EM_DASH}`)).toHaveLength(1);
  });

  it("checks the ends of the message too", () => {
    expect(commitMessageProblems(`fix: x\n\nbody${String.fromCodePoint(0x0b)}`)).toHaveLength(1);
  });
});
