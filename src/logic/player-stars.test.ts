import { describe, expect, it } from "vitest";
import { playerStars } from "./player-stars.ts";

describe("playerStars", () => {
  it("rates the OVR against the game's thresholds in half stars", () => {
    expect([54, 55, 57, 59, 60, 70, 74, 94, 95, 99].map(playerStars)).toEqual([
      0.5, 1, 1, 1, 1.5, 2.5, 2.5, 4.5, 5, 5,
    ]);
  });
});
