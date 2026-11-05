import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { offerContextOf, offerTerms } from "./offer.ts";
import { buildPlayers } from "./players.ts";
import { buildPlainSave, buildScoutDb, SCOUT_USER_TEAM_ID } from "./test-support/scout-db.ts";
import type { OfferContext } from "./offer.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

/** A manager of prestige 2 and finances 4 at a club in a country outside the five big leagues. */
const CONTEXT: OfferContext = {
  prestige: 2,
  finance: 4,
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

describe("offerTerms", () => {
  it("asks for 135 % of the value from a manager of prestige 2 and finances 4, unlisted", () => {
    expect(offerTerms(player(), CONTEXT)).toMatchObject({ fee: 135_000, feeOverCap: true });
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

  it("finds the least wage that gives the player no fewer than 0 points", () => {
    // Prestige -3 and finances -1: the wage must bring +4, 4/15 above the market wage.
    expect(offerTerms(player(), CONTEXT)).toMatchObject({
      years: 2,
      wage: 3800,
      wageOverCap: true,
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

  it("skips the club when the contract has run out, and needs a wage", () => {
    expect(offerTerms(player({ price: 0 }), CONTEXT)).toMatchObject({ fee: null });
    expect(offerTerms(player({ wage: null }), CONTEXT)).toBeNull();
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
      finance: 0,
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
});
