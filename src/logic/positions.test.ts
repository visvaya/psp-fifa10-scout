import { describe, expect, it } from "vitest";
import {
  byGroup,
  lineOf,
  POSITION_CODES,
  POSITION_GROUP_ROWS,
  POSITION_GROUPS,
  positionCodesOf,
  positionOf,
  rowRating,
} from "./positions.ts";
import type { PositionGroup } from "./positions.ts";

const byGroupOf = (value: number) => byGroup(() => value);

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
    expect(POSITION_GROUP_ROWS.flat()).toHaveLength(POSITION_GROUPS.length);
    expect(new Set(POSITION_GROUP_ROWS.flat())).toEqual(new Set(POSITION_GROUPS));
  });

  it("orders groups and card rows as the game orders its codes (scouting screen, code list)", () => {
    const groupCodes = POSITION_GROUPS.map((group) => firstCode([group]));
    const rowCodes = POSITION_GROUP_ROWS.map(firstCode);
    expect(groupCodes).toEqual(groupCodes.toSorted((a, b) => a - b));
    expect(rowCodes).toEqual(rowCodes.toSorted((a, b) => a - b));
  });

  it("separates the sweeper, the side midfielders and the wingers", () => {
    expect(positionOf(1).group).toBe("sweeper");
    expect(positionCodesOf("full-backs")).toEqual([3, 7]);
    expect(positionCodesOf("side-midfield")).toEqual([15, 19]);
    expect(positionCodesOf("wingers")).toEqual([14, 20]);
    expect(POSITION_GROUP_ROWS).toContainEqual(["full-backs", "sweeper"]);
    expect(POSITION_GROUP_ROWS).toContainEqual(["side-midfield", "wingers"]);
  });

  it("rates a card row by its first group, approximate where its groups differ", () => {
    const ratings = { ...byGroupOf(70), sweeper: 71 };
    expect(rowRating(ratings, ["full-backs", "sweeper"])).toEqual({ value: 70, approximate: true });
    expect(rowRating(ratings, ["side-midfield", "wingers"])).toEqual({
      value: 70,
      approximate: false,
    });
    expect(rowRating(ratings, ["goalkeeper"])).toEqual({ value: 70, approximate: false });
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

  it("uses the game's own names, which key the abbreviation of every language", () => {
    expect(POSITION_CODES.map((code) => positionOf(code).name).join(" ")).toBe(
      "GK SW RWB RB RCB CB LCB LB LWB RDM RCDM CDM LCDM LDM RWM RM RCM CM LCM LM LWM " +
        "RAM RCAM CAM LCAM LAM RF CF LF RS ST LS",
    );
  });
});
