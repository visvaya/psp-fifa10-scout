import { describe, expect, it } from "vitest";
import { bestPeakFields } from "./best-peak.ts";

/** A peak per position code 0..31, with the given codes raised. */
const peaks = (raised: Readonly<Record<number, number>>, base = 60): readonly number[] =>
  Array.from({ length: 32 }, (_, code) => raised[code] ?? base);
const overalls = (at: Readonly<Record<number, number>>): readonly number[] => peaks(at, 50);

describe("the best peak position", () => {
  it("takes the highest peak, though the preferred position peaks lower", () => {
    // Preferred 26 (RF) peaks at 82; the right midfield (15) at 83.
    expect(bestPeakFields(peaks({ 26: 82, 15: 83 }), overalls({ 15: 68, 26: 72 }), 26)).toEqual({
      bestPeak: 83,
      bestPeakCode: 15,
      bestPeakName: "RM",
      bestPeakGain: 15,
    });
  });

  it("keeps the preferred position on a tie", () => {
    expect(bestPeakFields(peaks({ 15: 83, 26: 83 }), overalls({}), 26)).toMatchObject({
      bestPeak: 83,
      bestPeakCode: 26,
      bestPeakName: "RF",
    });
  });

  it("takes the first code in order on a tie that leaves out the preferred position", () => {
    expect(bestPeakFields(peaks({ 19: 83, 15: 83, 30: 70 }), overalls({}), 30)).toMatchObject({
      bestPeakCode: 15,
    });
  });

  it("counts the goalkeeper like any other position", () => {
    expect(bestPeakFields(peaks({ 0: 90 }), overalls({ 0: 40 }), 17)).toMatchObject({
      bestPeak: 90,
      bestPeakCode: 0,
      bestPeakName: "GK",
      bestPeakGain: 50,
    });
  });

  it("has nothing without a career, where no peaks are projected", () => {
    expect(bestPeakFields([], overalls({}), 17)).toEqual({
      bestPeak: null,
      bestPeakCode: null,
      bestPeakName: null,
      bestPeakGain: null,
    });
  });
});
