import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { squadRefusal, squadsOf } from "./sale-rule.ts";
import { table } from "./test-support/player-fixtures.ts";
import { buildPlainSave, buildScoutDb, SCOUT_USER_TEAM_ID } from "./test-support/scout-db.ts";

/** A club of `size` players: `centreBacks` at CB (code 5), the rest in goal (code 0). */
const club = (size: number, centreBacks: number) =>
  squadsOf(
    Array.from({ length: size }, (_, index) => ({
      teamId: 1,
      positionCode: index < centreBacks ? 5 : 0,
      loaned: false,
    })),
  ).get(1);

const NO_SQUAD = { size: 0, groups: [] };

describe("squadRefusal", () => {
  // Boca Juniors (league prestige 12) would not sell its third centre-back: the group needs 4.
  it("refuses below the group's minimum, which rises with the league's prestige", () => {
    expect(squadRefusal(club(25, 3) ?? NO_SQUAD, 5, 12)).toBe("position");
    expect(squadRefusal(club(25, 3) ?? NO_SQUAD, 5, 11)).toBeNull();
    expect(squadRefusal(club(25, 4) ?? NO_SQUAD, 5, 12)).toBeNull();
  });

  it("refuses a club of 19 players or fewer, whatever the group, after the group's check", () => {
    expect(squadRefusal(club(19, 5) ?? NO_SQUAD, 0, 12)).toBe("squad");
    expect(squadRefusal(club(20, 5) ?? NO_SQUAD, 0, 12)).toBeNull();
    expect(squadRefusal(club(19, 3) ?? NO_SQUAD, 5, 12)).toBe("position");
  });

  it("leaves players on loan at the club out of the group but not out of the squad size", () => {
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
    expect(squadRefusal({ size: 25, groups: [0, 0, 0, 0, 0, 0, 0, 0] }, 40, 12)).toBeNull();
  });
});

/** The synthetic database with one historic rivalry. */
const rivals = (clubid1: number, clubid2: number) =>
  parseEaDb(buildScoutDb([table("historicrivalries", [{ clubid1, clubid2 }])]));

describe("saleVerdictOf (through buildPlayers)", () => {
  const db = parseEaDb(buildScoutDb());
  const save = parseCareerSave(db, buildPlainSave().dataBin);
  const playerIn = (career: typeof save, id: number, base = db) =>
    buildPlayers(base, career).find((item) => item.id === id);
  const of = (career: typeof save, id: number) => playerIn(career, id)?.clubWillSell;
  const refusal = (career: typeof save, id: number, base = db) =>
    playerIn(career, id, base)?.saleRefusal;

  // Barcelona keeps 21 players; Messi's group of right midfielders is deep enough. With its other right
  // midfielders on loan at it, he is alone in the group, below its minimum of 2.
  it("leaves players on loan at the club out of the group and skips a run-out contract", () => {
    expect(of(save, 158_023)).toBe(true);
    const wide = buildPlayers(db, save)
      .filter((player) => player.clubId === 241 && player.positionCode === 15)
      .map((player) => ({ playerid: player.id, oldteamid: 10 }));
    const lent = new Map([...save, ["career_loaned_list", wide]]);
    expect(of(lent, 158_023)).toBe(false);
    expect(refusal(lent, 158_023)).toBe("position");
    expect(of(save, 8)).toBeNull();
    // Brożek plays for the user's club: no offer to make.
    expect(of(save, 7)).toBeNull();
    // A contract that has run out (2009, the season's first year) skips the refusal.
    const runOut = buildPlayers(db, lent).filter(
      (player) =>
        player.clubId !== null &&
        player.clubId !== SCOUT_USER_TEAM_ID &&
        (player.contractEndYear ?? 0) <= 2009,
    );
    expect(runOut.length).toBeGreaterThan(0);
    expect(runOut.every((player) => player.clubWillSell === true)).toBe(true);
  });

  it("gives no verdict for the user's own player on loan at another club", () => {
    const lentOut = new Map([
      ...save,
      ["career_loaned_list", [{ playerid: 158_023, oldteamid: SCOUT_USER_TEAM_ID }]],
    ]);
    expect(of(lentOut, 158_023)).toBeNull();
    const lentByOther = new Map([
      ...save,
      ["career_loaned_list", [{ playerid: 158_023, oldteamid: 10 }]],
    ]);
    expect(of(lentByOther, 158_023)).toBe(true);
  });

  it("refuses the user's historic rival, in either order of the pair", () => {
    expect(refusal(save, 158_023)).toBeNull();
    expect(refusal(save, 158_023, rivals(SCOUT_USER_TEAM_ID, 241))).toBe("rivals");
    expect(refusal(save, 158_023, rivals(241, SCOUT_USER_TEAM_ID))).toBe("rivals");
  });
});
