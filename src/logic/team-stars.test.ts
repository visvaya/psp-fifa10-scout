import { describe, expect, it } from "vitest";
import { clubStarsOf, teamStars } from "./team-stars.ts";

describe("teamStars", () => {
  it("rates the floored mean of the best 16 against the game's thresholds", () => {
    expect(teamStars([])).toBe(0.5);
    expect(teamStars([54])).toBe(0.5);
    expect(teamStars([55])).toBe(1);
    expect(teamStars([62, 63])).toBe(1.5); // mean 62.5, floored to 62
    expect(teamStars([63])).toBe(2);
    expect(teamStars([71])).toBe(3.5);
    expect(teamStars([81, 82])).toBe(4.5);
    expect(teamStars([82, 99])).toBe(5);
  });

  it("counts only the best 16 players", () => {
    const squad = [
      ...Array.from({ length: 16 }, () => 75),
      ...Array.from({ length: 10 }, () => 40),
    ];
    expect(teamStars(squad)).toBe(4);
    expect(teamStars(squad.toReversed())).toBe(4);
  });
});

describe("clubStarsOf", () => {
  it("rates each club from its own players and leaves out players without a club", () => {
    const stars = clubStarsOf([
      { clubId: 1, overall: 80 },
      { clubId: 1, overall: 78 },
      { clubId: 2, overall: 60 },
      { clubId: null, overall: 99 },
    ]);
    expect([...stars]).toEqual([
      [1, 4.5],
      [2, 1.5],
    ]);
  });
});
