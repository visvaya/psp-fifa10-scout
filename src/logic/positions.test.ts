import { describe, expect, it } from "vitest";
import {
  lineOf,
  POSITION_CODES,
  POSITION_GROUPS,
  positionCodesOf,
  positionOf,
  RATING_CHOICES,
  ratingChoiceOf,
  ratingCodeOf,
} from "./positions.ts";
import { OVR_WEIGHTS } from "./overall-rating.ts";
import type { PositionGroup } from "./positions.ts";

const firstCode = (groups: readonly PositionGroup[]): number =>
  Math.min(...groups.flatMap(positionCodesOf));

describe("positionOf", () => {
  it("names codes and groups them, rejecting codes outside 0..31", () => {
    expect(positionOf(0)).toEqual({ name: "GK", group: "goalkeeper" });
    expect(positionOf(31)).toEqual({ name: "LS", group: "forwards" });
    expect(() => positionOf(32)).toThrow(/Unknown position code 32/);
  });

  it("puts every code in one group and every group in one card row", () => {
    expect(POSITION_GROUPS.flatMap(positionCodesOf).toSorted((a, b) => a - b)).toEqual(
      POSITION_CODES,
    );
  });

  it("orders groups and card rows as the game orders its codes (scouting screen, code list)", () => {
    const groupCodes = POSITION_GROUPS.map((group) => firstCode([group]));
    expect(groupCodes).toEqual(groupCodes.toSorted((a, b) => a - b));
  });

  it("separates the sweeper, the side midfielders and the wingers", () => {
    expect(positionOf(1).group).toBe("sweeper");
    expect(positionCodesOf("full-backs")).toEqual([3, 7]);
    expect(positionCodesOf("side-midfield")).toEqual([15, 19]);
    expect(positionCodesOf("wingers")).toEqual([14, 20]);
  });

  it("puts codes in the game's lines, which it colours", () => {
    expect([0, 1, 8, 9, 25, 26, 31].map(lineOf)).toEqual([
      "goalkeeper",
      "defence",
      "defence",
      "midfield",
      "midfield",
      "attack",
      "attack",
    ]);
  });

  it("offers one rating choice per way the game rates a position", () => {
    const rows = RATING_CHOICES.map(([code]) => OVR_WEIGHTS[code]);
    expect(new Set(rows).size).toBe(10);
    expect(new Set(OVR_WEIGHTS).size).toBe(10);
    for (const code of POSITION_CODES) {
      expect(OVR_WEIGHTS[ratingCodeOf(code)]).toBe(OVR_WEIGHTS[code]);
    }
  });

  it("rates every code at its choice's first code, the sweeper on its own", () => {
    expect([0, 1, 2, 4, 7, 14, 20, 31].map(ratingCodeOf)).toEqual([0, 1, 2, 5, 3, 15, 15, 30]);
    expect(RATING_CHOICES.map(([code]) => ratingCodeOf(code))).toEqual([
      0, 1, 2, 3, 5, 11, 15, 17, 23, 30,
    ]);
  });

  it("names a code's rating choice by its codes", () => {
    expect([7, 14, 4, 0].map(ratingChoiceOf)).toEqual([[3, 7], [15, 19], [5], [0]]);
  });

  it("uses the game's own names, which key the abbreviation of every language", () => {
    expect(POSITION_CODES.map((code) => positionOf(code).name).join(" ")).toBe(
      "GK SW RWB RB RCB CB LCB LB LWB RDM RCDM CDM LCDM LDM RWM RM RCM CM LCM LM LWM " +
        "RAM RCAM CAM LCAM LAM RF CF LF RS ST LS",
    );
  });
});
