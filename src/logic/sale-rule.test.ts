import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { clubWillSell, squadsOf } from "./sale-rule.ts";
import { buildPlainSave, buildScoutDb } from "./test-support/scout-db.ts";

/** A club of `size` players: `centreBacks` at CB (code 5), the rest in goal (code 0). */
const club = (size: number, centreBacks: number) =>
  squadsOf(
    Array.from({ length: size }, (_, index) => ({
      teamId: 1,
      positionCode: index < centreBacks ? 5 : 0,
      loaned: false,
    })),
  ).get(1);

describe("clubWillSell", () => {
  // Boca Juniors (league prestige 12) would not sell its third centre-back: the group needs 4.
  it("refuses below the group's minimum, which rises with the league's prestige", () => {
    const squad = club(25, 3);
    expect(squad && clubWillSell(squad, 5, 12)).toBe(false);
    expect(squad && clubWillSell(squad, 5, 11)).toBe(true);
    expect(club(25, 4) && clubWillSell(club(25, 4) ?? { size: 0, groups: [] }, 5, 12)).toBe(true);
  });

  it("refuses a club of 19 players or fewer, whatever the group", () => {
    expect(clubWillSell(club(19, 5) ?? { size: 0, groups: [] }, 0, 12)).toBe(false);
    expect(clubWillSell(club(20, 5) ?? { size: 0, groups: [] }, 0, 12)).toBe(true);
  });

  it("leaves loaned-out players out of the group but not out of the squad size", () => {
    const squad = squadsOf([
      ...Array.from({ length: 18 }, () => ({ teamId: 2, positionCode: 0, loaned: false })),
      { teamId: 2, positionCode: 5, loaned: false },
      { teamId: 2, positionCode: 5, loaned: false },
      { teamId: 2, positionCode: 5, loaned: false },
      { teamId: 2, positionCode: 5, loaned: true },
    ]).get(2);
    expect(squad).toEqual({ size: 22, groups: [18, 0, 3, 0, 0, 0, 0, 0] });
  });

  it("does not check a position code outside the game's 32", () => {
    expect(clubWillSell({ size: 25, groups: [0, 0, 0, 0, 0, 0, 0, 0] }, 40, 12)).toBe(true);
  });
});

describe("clubWillSellOf (through buildPlayers)", () => {
  const db = parseEaDb(buildScoutDb());
  const save = parseCareerSave(db, buildPlainSave().dataBin);
  const of = (career: typeof save, id: number) =>
    buildPlayers(db, career).find((player) => player.id === id)?.clubWillSell;

  // Barcelona keeps 21 players; Messi's group of right midfielders is deep enough. Lending out its
  // other right midfielders leaves him alone in the group, below its minimum of 2.
  it("leaves loaned-out players out of the group and skips a run-out contract", () => {
    expect(of(save, 158_023)).toBe(true);
    const wide = buildPlayers(db, save)
      .filter((player) => player.clubId === 241 && player.positionCode === 15)
      .map((player) => ({ playerid: player.id }));
    const lent = new Map([...save, ["career_loaned_list", wide]]);
    expect(of(lent, 158_023)).toBe(false);
    expect(of(save, 8)).toBeNull();
    // A contract that has run out (2009, the season's first year) skips the refusal.
    const runOut = buildPlayers(db, lent).filter(
      (player) => player.clubId !== null && (player.contractEndYear ?? 0) <= 2009,
    );
    expect(runOut.length).toBeGreaterThan(0);
    expect(runOut.every((player) => player.clubWillSell === true)).toBe(true);
  });
});
