import { describe, expect, it } from "vitest";
import { levelUpOf, matchesToLevelUp } from "./level-up.ts";

const row = (playerid: number, levelUpXp: number, xp: Readonly<Record<string, number>>) =>
  Object.freeze({ playerid, level_up_xp: levelUpXp, ...xp });

// match-growth.md section 4: the bar is level_up_xp out of 1000; the points the next level-up gives are
// one for every full 100 XP of each attribute.
describe("levelUpOf", () => {
  it("reads the bar and counts the points of each attribute's full hundreds", () => {
    const fields = levelUpOf(
      [row(7, 640, { finishing_xp: 250, crossing_xp: 99, stamina_xp: 100, marking_xp: -40 })],
      new Set([7]),
    );
    expect(fields.get(7)).toEqual({ levelUpXp: 640, levelUpPoints: 3 });
  });

  it("keeps only the rows of the squad, not of players who left it", () => {
    const fields = levelUpOf([row(7, 10, {}), row(8, 20, {})], new Set([8]));
    expect([...fields.keys()]).toEqual([8]);
  });
});

describe("matchesToLevelUp", () => {
  // Measured: 15 to 53 XP a match for a player who plays (match-growth.md section 4).
  it("ranges the matches to 1000 between the most and the least XP a match", () => {
    expect(matchesToLevelUp(640)).toEqual({ fewest: 7, most: 24 });
    expect(matchesToLevelUp(990)).toEqual({ fewest: 1, most: 1 });
  });

  it("needs no match once the bar is full", () => {
    expect(matchesToLevelUp(1000)).toEqual({ fewest: 0, most: 0 });
    expect(matchesToLevelUp(1180)).toEqual({ fewest: 0, most: 0 });
  });
});
