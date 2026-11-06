import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { columnLabel, columnText } from "./player-list.tsx";

describe("the best peak columns", () => {
  const player = testPlayer({
    bestPeak: 83,
    bestPeakCode: 15,
    bestPeakName: "ŚPO",
    bestPeakGain: 12,
  });

  it("draws the peak as a rating, whose width counts the position beside it, the gain as a number", () => {
    expect(columnText(player, "bestPeak", null)).toBeNull();
    expect(columnText(player, "bestPeakGain", null)).toBe("12");
  });

  it("has no text without a career", () => {
    expect(columnText(testPlayer(), "bestPeak", null)).toBeNull();
    expect(columnText(testPlayer(), "bestPeakGain", null)).toBeNull();
  });

  it("is named for the best peak", () => {
    expect(columnLabel("bestPeak")).toBe("Najlepszy szczyt");
    expect(columnLabel("bestPeakGain")).toBe("Zapas do najlepszego szczytu");
  });
});
