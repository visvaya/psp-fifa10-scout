import { describe, expect, it } from "vitest";
import { bestPeakFields } from "./best-peak.ts";
import type { PeakInput } from "./best-peak.ts";

/** A peak per position code 0..31, with the given codes raised. */
const peaks = (raised: Readonly<Record<number, number>>, base = 60): readonly number[] =>
  Array.from({ length: 32 }, (_, code) => raised[code] ?? base);
const overalls = (at: Readonly<Record<number, number>>): readonly number[] => peaks(at, 50);

/** The same peak at each of the codes. */
const tiedAt = (codes: readonly number[], peak = 80): readonly number[] =>
  peaks(Object.fromEntries(codes.map((code) => [code, peak])));

// The real Wisła save's 4-4-2: GK, LB, LCB, RCB, RB, LM, LCM, RCM, RM, LS, RS.
const FOUR_FOUR_TWO = [0, 7, 6, 4, 3, 19, 18, 16, 15, 31, 29];
const FIVE_THREE_TWO = [0, 8, 6, 5, 4, 2, 18, 17, 16, 31, 29];
const FORWARDS = [26, 27, 28, 29, 30, 31];
const CENTRE_BACKS = [4, 5, 6];

type Tie = Partial<Omit<PeakInput, "peakByCode" | "overallByCode">> & {
  readonly formationCodes?: readonly number[];
};

/** The best peak of a right-footed striker, weak foot 3 stars, with no formation unless `tie` says. */
const fields = (
  peakByCode: readonly number[],
  overallByCode: readonly number[],
  { formationCodes = [], ...tie }: Tie = {},
) =>
  bestPeakFields(
    { peakByCode, overallByCode, positionCode: 30, preferredFoot: "right", weakFoot: 3, ...tie },
    formationCodes,
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
    // No right code among CB and LCB: both stay, and the preferred LCB wins over the first code.
    expect(chosen([5, 6], { positionCode: 6 })).toBe(6);
  });

  it("takes the first code left when nothing else decides", () => {
    expect(chosen([5, 6])).toBe(5);
    expect(chosen(FORWARDS, { weakFoot: 4, positionCode: 17 })).toBe(27);
  });
});
