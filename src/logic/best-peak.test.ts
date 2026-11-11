import { describe, expect, it } from "vitest";
import { bestPeakFields, movedRule, otherPeakChoices, TIE_RULES, tieOrderOf } from "./best-peak.ts";
import type { PeakInput, TieRule } from "./best-peak.ts";
import { FOUR_FOUR_TWO } from "./test-support/player-fixtures.ts";

/** A peak per position code 0..31, with the given codes raised. */
const peaks = (raised: Readonly<Record<number, number>>, base = 60): readonly number[] =>
  Array.from({ length: 32 }, (_, code) => raised[code] ?? base);
const overalls = (at: Readonly<Record<number, number>>): readonly number[] => peaks(at, 50);

/** The same peak at each of the codes. */
const tiedAt = (codes: readonly number[], peak = 80): readonly number[] =>
  peaks(Object.fromEntries(codes.map((code) => [code, peak])));

const FIVE_THREE_TWO = [0, 8, 6, 5, 4, 2, 18, 17, 16, 31, 29];
const FORWARDS = [26, 27, 28, 29, 30, 31];
const CENTRE_BACKS = [4, 5, 6];

type Tie = Partial<Omit<PeakInput, "peakByCode" | "overallByCode">> & {
  readonly formationCodes?: readonly number[];
  readonly order?: readonly TieRule[];
};

/**
 * The best peak of a right-footed striker, weak foot 3 stars, with no formation and the default order
 * of the tie rules unless `tie` says.
 */
const fields = (
  peakByCode: readonly number[],
  overallByCode: readonly number[],
  { formationCodes = [], order, ...tie }: Tie = {},
) =>
  bestPeakFields(
    { peakByCode, overallByCode, positionCode: 30, preferredFoot: "right", weakFoot: 3, ...tie },
    formationCodes,
    order,
  );

/** The best peak code of a tie at `codes`. */
const chosen = (codes: readonly number[], tie: Tie = {}): number | null =>
  fields(tiedAt(codes), overalls({}), tie).bestPeakCode;

describe("the best peak position", () => {
  it("takes the highest peak, though the preferred position peaks lower", () => {
    // Preferred 26 (RF) peaks at 82; the right midfield (15) at 83.
    expect(
      fields(peaks({ 26: 82, 15: 83 }), overalls({ 15: 68, 26: 72 }), { positionCode: 26 }),
    ).toEqual({
      bestPeak: 83,
      bestPeakCode: 15,
      bestPeakName: "RM",
      bestPeakGain: 15,
    });
  });

  it("keeps the preferred position on a tie", () => {
    expect(fields(peaks({ 15: 83, 26: 83 }), overalls({}), { positionCode: 26 })).toMatchObject({
      bestPeak: 83,
      bestPeakCode: 26,
      bestPeakName: "RF",
    });
  });

  it("takes the first code in order on a tie that leaves out the preferred position", () => {
    expect(fields(peaks({ 19: 83, 15: 83, 30: 70 }), overalls({}), {})).toMatchObject({
      bestPeakCode: 15,
    });
  });

  it("counts the goalkeeper like any other position", () => {
    expect(fields(peaks({ 0: 90 }), overalls({ 0: 40 }), { positionCode: 17 })).toMatchObject({
      bestPeak: 90,
      bestPeakCode: 0,
      bestPeakName: "GK",
      bestPeakGain: 50,
    });
  });

  it("has nothing without a career, where no peaks are projected", () => {
    expect(fields([], overalls({}), { positionCode: 17 })).toEqual({
      bestPeak: null,
      bestPeakCode: null,
      bestPeakName: null,
      bestPeakGain: null,
    });
  });
});

describe("the best peak position on a tie", () => {
  it("keeps the tied codes of the formation, the side by the better foot", () => {
    // RS and LS stand in the 4-4-2; ST, RF, CF and LF do not.
    expect(chosen(FORWARDS, { formationCodes: FOUR_FOUR_TWO })).toBe(29);
    expect(chosen(FORWARDS, { formationCodes: FOUR_FOUR_TWO, preferredFoot: "left" })).toBe(31);
  });

  it("takes the centre with a weak foot of 4 or 5 stars, when the centre is a candidate", () => {
    expect(chosen(CENTRE_BACKS, { formationCodes: FIVE_THREE_TWO, weakFoot: 4 })).toBe(5);
    expect(
      chosen(CENTRE_BACKS, { formationCodes: FIVE_THREE_TWO, weakFoot: 5, positionCode: 6 }),
    ).toBe(5);
    // A weak foot of 3 stars goes by the better foot instead.
    expect(chosen(CENTRE_BACKS, { formationCodes: FIVE_THREE_TWO, preferredFoot: "left" })).toBe(6);
    // The 4-4-2 has no CB: the better foot decides.
    expect(
      chosen(CENTRE_BACKS, { formationCodes: FOUR_FOUR_TWO, weakFoot: 4, preferredFoot: "left" }),
    ).toBe(6);
  });

  it("takes every tied code when none is in the formation", () => {
    // No attacking midfielder in the 4-4-2: the left-footed player's left codes, LCAM before LAM.
    expect(
      chosen([21, 22, 23, 24, 25], { formationCodes: FOUR_FOUR_TWO, preferredFoot: "left" }),
    ).toBe(24);
    expect(chosen([21, 22, 23, 24, 25], { formationCodes: FOUR_FOUR_TWO, weakFoot: 4 })).toBe(23);
  });

  it("keeps the preferred position only among the codes left, after the formation and the foot", () => {
    expect(chosen([21, 22, 23, 24, 25], { preferredFoot: "left", positionCode: 25 })).toBe(25);
    // A right-footed left midfielder still peaks on the right in a 4-4-2.
    expect(chosen([14, 15, 19, 20], { formationCodes: FOUR_FOUR_TWO, positionCode: 19 })).toBe(15);
  });

  it("takes the centre before the other side when nothing is on the side of the better foot", () => {
    // Owner's rule, 2026-11-10: a left-footed player tied on RCB and CB, with no LCB, takes CB.
    expect(chosen([4, 5], { preferredFoot: "left" })).toBe(5);
    // The preferred LCB of a right-footed player comes after the centre.
    expect(chosen([5, 6], { positionCode: 6 })).toBe(5);
    // With no centre either, every code on the other side stays.
    expect(chosen([2, 3], { preferredFoot: "left", positionCode: 3 })).toBe(3);
  });

  it("takes the first code left when nothing else decides", () => {
    expect(chosen([5, 6])).toBe(5);
    expect(chosen(FORWARDS, { weakFoot: 4, positionCode: 17 })).toBe(27);
  });
});

/** The rules first, the others after them in the default order. */
const order = (...rules: readonly TieRule[]): readonly TieRule[] => tieOrderOf(rules);

describe("the best peak position with the user's order of the tie rules", () => {
  it("goes by the default order when given it", () => {
    expect(chosen(FORWARDS, { formationCodes: FOUR_FOUR_TWO, order: TIE_RULES })).toBe(29);
  });

  it("takes the preferred position over the formation when it comes first", () => {
    // ST (30) is not in the 4-4-2; first in the order, the preferred position wins.
    expect(chosen(FORWARDS, { formationCodes: FOUR_FOUR_TWO })).toBe(29);
    expect(
      chosen(FORWARDS, { formationCodes: FOUR_FOUR_TWO, order: order("preferredPosition") }),
    ).toBe(30);
  });

  it("takes the side of the better foot over the centre when it comes first", () => {
    expect(chosen(CENTRE_BACKS, { weakFoot: 4 })).toBe(5);
    expect(chosen(CENTRE_BACKS, { weakFoot: 4, order: order("betterFootSide") })).toBe(4);
  });

  it("takes the better foot over the formation when it comes first", () => {
    // Left-footed, with only RF and CF in the formation: neither is on the left, so the centre.
    const tie = { formationCodes: [26, 27], preferredFoot: "left" as const, positionCode: 17 };
    expect(chosen(FORWARDS, tie)).toBe(27);
    expect(chosen(FORWARDS, { ...tie, order: order("betterFootSide") })).toBe(28);
  });
});

describe("the order of the tie rules", () => {
  it("drops unknown and repeated rules and adds the missing ones in the default order", () => {
    expect(tieOrderOf(["preferredPosition", "nope", "preferredPosition", 3])).toEqual([
      "preferredPosition",
      "formation",
      "weakFootCentre",
      "betterFootSide",
    ]);
    expect(tieOrderOf("formation")).toEqual(TIE_RULES);
    expect(tieOrderOf(undefined)).toEqual(TIE_RULES);
  });

  it("moves a rule up or down by one, and not past either end", () => {
    expect(movedRule(TIE_RULES, "weakFootCentre", -1)).toEqual([
      "weakFootCentre",
      "formation",
      "betterFootSide",
      "preferredPosition",
    ]);
    expect(movedRule(TIE_RULES, "weakFootCentre", 1)).toEqual([
      "formation",
      "betterFootSide",
      "weakFootCentre",
      "preferredPosition",
    ]);
    expect(movedRule(TIE_RULES, "formation", -1)).toEqual(TIE_RULES);
    expect(movedRule(TIE_RULES, "preferredPosition", 1)).toEqual(TIE_RULES);
  });
});

// Owner, 2026-11-10: the note of the other positions with the same best peak names groups, not the side
// variants of the shown position's own group.
describe("otherPeakChoices", () => {
  it("names each other way of rating that reaches the same peak, once, without the shown one's", () => {
    // LB (7) shown; RB (3) rates the same way, CB (5) and RWB (2) do not.
    expect(otherPeakChoices(tiedAt([3, 7]), 80, 7)).toEqual([]);
    expect(otherPeakChoices(tiedAt([2, 3, 5, 6, 7, 8]), 80, 7)).toEqual([2, 5]);
  });
});
