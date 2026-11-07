import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { BONUS_PERCENTS, DEFAULT_CHOICE, offerContextOf, offerTerms } from "./offer.ts";
import { buildPlayers } from "./players.ts";
import { buildPlainSave, buildScoutDb, SCOUT_USER_TEAM_ID } from "./test-support/scout-db.ts";
import type { OfferContext } from "./offer.ts";
import type { CareerSave } from "../data/career-save.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import {
  attributes,
  flatCurves,
  playerRow,
  table,
  formationTables,
  testPlayer,
} from "./test-support/player-fixtures.ts";

/** A manager of prestige 2 and a negotiator of level 4 at a club in a country outside the five big leagues. */
const CONTEXT: OfferContext = {
  prestige: 2,
  negotiator: 4,
  squadAverage: 65,
  countryId: 37,
  seasonEndYear: 2010,
};

// Age 24 at the season's end, retiring at 35, wanting 2 years (id % 5 + 1).
const player = (overrides: Parameters<typeof testPlayer>[0] = {}) =>
  testPlayer({
    id: 6,
    birthYear: 1986,
    retirementAge: 35,
    overall: 65,
    nationalityId: 1,
    price: 100_000,
    wage: 3000,
    transferListed: false,
    traits: [],
    ...overrides,
  });

/** The least wage by a plain scan: W 3000, the wage term and the bonus term for `pct` percent. */
const scan = (needed: number, pct: number): number => {
  let wage = 0;
  const points = (w: number) =>
    Math.trunc((15 * (w - 3000)) / 3000) -
    (w < 3000 ? 1 : 0) +
    Math.trunc((w * pct * 20) / 300_000);
  while (points(wage) < needed) wage += 1;
  return wage;
};

describe("offerTerms", () => {
  it("asks for 135 % of the value from a manager of prestige 2 and a negotiator of level 4, unlisted", () => {
    expect(offerTerms(player(), CONTEXT)).toMatchObject({ fee: 135_000, feeOverCap: false });
    // Exactly, where a decimal 1.35 would round up past it.
    expect(offerTerms(player({ price: 170_000 }), CONTEXT)?.fee).toBe(229_500);
  });

  it("asks less for a listed player: the fee plus its prestige bonus reaches the value", () => {
    // 100 000 / (1 + 2 * 1.4 / 39) = 93 301.9...
    expect(offerTerms(player({ transferListed: true }), CONTEXT)).toMatchObject({
      fee: 93_302,
      feeOverCap: false,
    });
  });

  it("limits the first offer to 1.5 times the value and the market wage", () => {
    const novice = { ...CONTEXT, prestige: 0, negotiator: 0 };
    expect(offerTerms(player(), novice)).toMatchObject({ fee: 150_000, feeOverCap: false });
    // The fee is rounded up to a whole unit, so only an odd value can end above the limit by half a unit;
    // a player nobody can buy (needs 1.5 times the value) shows the warning through that rounding alone.
    expect(offerTerms(player({ price: 100_001 }), novice)).toMatchObject({ feeOverCap: true });
    // A star in a weak squad: -18 from strength, so the wage must bring +22, 2.47 times the market wage.
    expect(offerTerms(player({ overall: 90 }), CONTEXT)).toMatchObject({
      wage: 7400,
      wageOverCap: true,
    });
  });

  it("finds the least wage that gives the player no fewer than 0 points", () => {
    // Prestige -3 and negotiator -1: the wage must bring +4, 4/15 above the market wage.
    expect(offerTerms(player(), CONTEXT)).toMatchObject({
      years: 2,
      wantedYears: 2,
      longestYears: 5,
      wage: 3800,
      wageOverCap: false,
    });
    // A weaker player in a stronger squad: +7 from strength (trunc(10 * 0.75)), +3 to spare below W.
    expect(offerTerms(player({ overall: 55 }), CONTEXT)).toMatchObject({ wage: 2401 });
  });

  it("counts the same country, a big league and the player's club identification", () => {
    const home = offerTerms(player({ nationalityId: 37 }), CONTEXT);
    const loyal = offerTerms(player({ traits: ["highclubidentification"] }), CONTEXT);
    const english = offerTerms(player(), { ...CONTEXT, countryId: 14 });
    expect([home?.wage, loyal?.wage, english?.wage]).toEqual([3400, 4200, 3600]);
  });

  it("caps the contract at the retirement age and refuses past it", () => {
    expect(offerTerms(player({ birthYear: 1976 }), CONTEXT)).toMatchObject({ years: 1 });
    expect(offerTerms(player({ birthYear: 1975 }), CONTEXT)).toMatchObject({
      years: 0,
      wage: null,
    });
  });

  it("takes the double offer's two points off the wage", () => {
    expect(offerTerms(player(), CONTEXT, { ...DEFAULT_CHOICE, double: true })?.wage).toBe(3400);
  });

  it("charges a point for every year off the length he wants, either way", () => {
    const wage = (years: number) =>
      offerTerms(player(), CONTEXT, { ...DEFAULT_CHOICE, years })?.wage;
    expect([wage(1), wage(2), wage(3), wage(5)]).toEqual([4000, 3800, 4000, 4400]);
    expect(offerTerms(player(), CONTEXT, { ...DEFAULT_CHOICE, years: 2 })).toEqual(
      offerTerms(player(), CONTEXT),
    );
  });

  it("allows no contract past the end of his career", () => {
    // Retires at 35, 34 at the season's end: one year left.
    const old = player({ birthYear: 1976 });
    expect(offerTerms(old, CONTEXT)).toMatchObject({ longestYears: 1, years: 1 });
    expect(offerTerms(old, CONTEXT, { ...DEFAULT_CHOICE, years: 3 })).toMatchObject({
      years: 3,
      wage: null,
    });
  });

  // Wage W 3000, the player brings exactly 0 points besides the wage term: strength +4 offsets prestige and
  // negotiator, the squad averaging 6 points of OVR above him.
  describe("with a bonus", () => {
    const even = player({ overall: 59 });
    const wage = (bonusPercent: number, p = even) =>
      offerTerms(p, CONTEXT, { ...DEFAULT_CHOICE, bonusPercent })?.wage;

    it("needs exactly the market wage at 0 % and 5 % (below it the bonus earns nothing)", () => {
      expect([wage(0), wage(5)]).toEqual([3000, 3000]);
    });

    it("accepts a wage just under the market wage when a larger bonus makes up the point", () => {
      // 10 %: the bonus gives 1 point from 1500, so 2801 reaches 0 (the wage term truncates to 0, less 1).
      // 15 %: it gives 2 from 2000, so 2601 does.
      expect([wage(10), wage(15)]).toEqual([2801, 2601]);
    });

    it("lowers a wage above the market wage by the points the bonus gives", () => {
      // Needs +4: the wage term gives 3 from 3600, the 5 % bonus (trunc(wage / 3000)) 1; with 15 %
      // (trunc(wage / 1000)) the wage term needs only 1, from 3200.
      expect([wage(5, player()), wage(15, player())]).toEqual([3600, 3200]);
      // One more point needed (OVR 67: strength -1): the wage term must give 4 with the 5 % bonus's 1.
      expect(wage(5, player({ overall: 67 }))).toBe(3800);
    });

    it("reports the bonus as the percentage of the wage, rounded to a unit, and 0 without a wage", () => {
      const bonus = (p: ReturnType<typeof player>, bonusPercent: number) =>
        offerTerms(p, CONTEXT, { ...DEFAULT_CHOICE, bonusPercent })?.bonus;
      expect([bonus(player(), 0), bonus(player(), 15), bonus(player(), 5)]).toEqual([0, 480, 180]);
      expect(bonus(player({ birthYear: 1975 }), 15)).toBe(0);
    });

    it("lets a bonus cut the wage below the market wage too", () => {
      // Strength +7 leaves 3 points to spare: 2401 without a bonus, 2001 with 15 %.
      expect([wage(0, player({ overall: 55 })), wage(15, player({ overall: 55 }))]).toEqual([
        2401, 2001,
      ]);
    });
  });

  it("searches within W (15 + needed) / 15 whatever the points and the bonus", () => {
    // Every squad gap from a star to a novice, against a plain scan for the least wage.
    for (const overall of [30, 45, 55, 59, 62, 65, 67, 75, 90, 99]) {
      const needed = 4 - Math.trunc((65 - overall) * 0.75);
      for (const bonusPercent of BONUS_PERCENTS) {
        const terms = offerTerms(player({ overall }), CONTEXT, { ...DEFAULT_CHOICE, bonusPercent });
        expect(terms?.wage).toBe(scan(needed, bonusPercent));
      }
    }
  });

  it("skips the club when the contract has run out, and needs a wage", () => {
    expect(offerTerms(player({ price: 0 }), CONTEXT)).toMatchObject({ fee: null });
    expect(offerTerms(player({ wage: null }), CONTEXT)).toBeNull();
    // A market wage of 0 leaves nothing to scale: any wage will do.
    expect(offerTerms(player({ wage: 0 }), CONTEXT)).toMatchObject({ wage: 0 });
  });
});

describe("offerContextOf", () => {
  // The synthetic career: everyone at the user's club sits on the bench (position 33), rated at the
  // preferred position; its manager has no prestige or upgrades and its league no country.
  it("reads the manager, the squad's mean OVR and the season's end from the save", () => {
    const db = parseEaDb(buildScoutDb());
    const save = parseCareerSave(db, buildPlainSave().dataBin);
    const players = buildPlayers(db, save);
    const squad = players.filter((each) => each.clubId === SCOUT_USER_TEAM_ID);
    const mean = Math.floor(squad.reduce((sum, each) => sum + each.overall, 0) / squad.length);
    expect(offerContextOf(db, save, players)).toEqual({
      prestige: 0,
      negotiator: 0,
      squadAverage: mean,
      countryId: null,
      seasonEndYear: 2010,
    });
  });

  it("rates an empty squad 0 and skips links to players it does not know", () => {
    const db = parseEaDb(buildScoutDb());
    const save = parseCareerSave(db, buildPlainSave().dataBin);
    const unknown = new Map([
      ...save,
      ["teamplayerlinks", [{ teamid: SCOUT_USER_TEAM_ID, playerid: 999_999, position: 3 }]],
    ]);
    expect(offerContextOf(db, unknown, buildPlayers(db, save)).squadAverage).toBe(0);
  });

  // A goalkeeper's hands and a striker's finishing: his OVR in goal and up front differ.
  it("rates a starter at his team-sheet position and reads the league's country", () => {
    // Data rows, alike by nature. jscpd:ignore-start
    const db = parseEaDb(
      buildEaDb([
        table("leagues", [
          { leagueid: 1, leaguename: "L", level: 1, leagueprestige: 10, countryid: 37 },
        ]),
        table("teams", [
          { teamid: 9, teamname: "Mine", overallrating: 60, internationalprestige: 5 },
        ]),
        table("leagueteamlinks", [{ leagueid: 1, teamid: 9 }]),
        table("country", [{ countryid: 37, countryname: "Poland" }]),
        table("players", [
          playerRow({
            playerid: 1,
            preferredposition1: 0,
            ...attributes(40, { gkdiving: 90, handling: 90, gkpositioning: 90, reflexes: 90 }),
          }),
        ]),
        table("teamplayerlinks", [
          { teamid: 9, playerid: 1, position: 29, jerseynumber: 1, yearcontractvalidtil: 2012 },
        ]),
        ...[
          "playerstats",
          "career_youth_accademy",
          "career_transfer_list",
          "career_extra_user_team_info",
        ].map((name) => ({
          name,
          u32: ["playerid"],
          rows: [],
        })),
        table("career_players_grown_attributes", [{ playerid: 0, potential_delta: 0 }]),
        flatCurves(),
        ...formationTables(9),
      ]),
    );
    // jscpd:ignore-end
    const save: CareerSave = new Map([
      [
        "team_manager",
        [
          {
            team_id: 9,
            firstname: "A",
            surname: "B",
            last_game_number: 0,
            currency: 0,
            prestige: 3,
            upgrade_fin: 2,
          },
        ],
      ],
    ]);
    const players = buildPlayers(db, save);
    const [keeper] = players;
    expect(keeper?.overallByCode[29]).not.toBe(keeper?.overall);
    expect(offerContextOf(db, save, players)).toMatchObject({
      prestige: 3,
      negotiator: 2,
      squadAverage: keeper?.overallByCode[29],
      countryId: 37,
    });
  });
});
