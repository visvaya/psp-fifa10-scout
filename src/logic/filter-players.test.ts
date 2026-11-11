import { describe, expect, it } from "vitest";
import { filterPlayers, peakField, rangedAttributes } from "./filter-players.ts";
import type { ClubStatus, ListMembership, PlayerFilters } from "./filter-players.ts";
import { attributes, testPlayer } from "./test-support/player-fixtures.ts";

const PLAYERS = [
  testPlayer({ id: 1, name: "Paweł Brożek", age: 26, potential: 75, nationalityId: 37 }),
  testPlayer({
    id: 2,
    name: "Lionel Messi",
    age: 22,
    potential: 95,
    growth: 35,
    positionCode: 14,
    positionGroup: "wingers",
    preferredFoot: "left",
    height: 169,
    attributes: attributes(50, { dribbling: 97, finishing: 90 }),
    traits: ["playmaker", "technicaldribbler"],
    clubId: 241,
    clubRating: 84,
    leagueId: 53,
    contractEndYear: 2014,
    nationalTeamId: 1369,
    nationalityId: 52,
    loanedFromId: 1873,
  }),
  testPlayer({
    id: 3,
    name: "Free Agent",
    freeAgent: true,
    age: 31,
    potential: 60,
    positionCode: 0,
    positionGroup: "goalkeeper",
    traits: ["puncher"],
    clubId: null,
    clubRating: null,
    leagueId: null,
    contractEndYear: null,
  }),
  testPlayer({
    id: 4,
    name: "Young",
    age: 17,
    potential: 80,
    overall: 62,
    growth: 18,
    contractEndYear: 2010,
    form: 4,
    transferListed: true,
    shortlisted: true,
    clubWillSell: true,
    loanListed: true,
  }),
];

const ids = (filters: PlayerFilters): readonly number[] =>
  filterPlayers(PLAYERS, filters).map((player) => player.id);

// Players without a club: an academy junior, a legend, a free-agent junior and a scouted junior on the
// shortlist, not signed.
const CLUBLESS = [
  testPlayer({ id: 5, name: "Academy", clubId: null, youth: true, academy: true }),
  testPlayer({ id: 6, name: "Legend", clubId: null, nationalTeamId: 1369 }),
  testPlayer({ id: 7, name: "Free youth", clubId: null, youth: true, freeAgent: true }),
  testPlayer({ id: 8, name: "Scouted", clubId: null, youth: true }),
];
const idsWithClubless = (filters: PlayerFilters) =>
  filterPlayers([...PLAYERS, ...CLUBLESS], filters).map((player) => player.id);
const status = (clubStatus: ClubStatus) => idsWithClubless({ clubStatus });

/** Players 1..4 rated id x 10 at position code 1 and 50 elsewhere, with this OVR. */
const ratedAtCode1 = (overall = 50) =>
  [1, 2, 3, 4].map((id) =>
    testPlayer({
      id,
      overall,
      overallByCode: Array.from({ length: 32 }, (_, code) => (code === 1 ? id * 10 : 50)),
    }),
  );

/** A player rated `rating` at position code 5 and 60 everywhere else. */
const ratedAt5 = (id: number, rating: number) =>
  testPlayer({
    id,
    overallByCode: Array.from({ length: 32 }, (_, code) => (code === 5 ? rating : 60)),
  });

describe("filterPlayers", () => {
  it("returns everything for empty filters", () => {
    expect(ids({})).toEqual([1, 2, 3, 4]);
    expect(ids({ ranges: {}, lists: {}, flags: {} })).toEqual([1, 2, 3, 4]);
  });

  it("searches names ignoring case and diacritics", () => {
    expect(ids({ text: "  brozek " })).toEqual([1]);
    expect(ids({ text: "MES" })).toEqual([2]);
    expect(ids({ text: "  " })).toEqual([1, 2, 3, 4]);
  });

  it("keeps any of the chosen values of a list, by code or by name", () => {
    expect(ids({ lists: { positionGroup: ["wingers", "goalkeeper"] } })).toEqual([2, 3]);
    expect(ids({ lists: { positionCode: [14, 17] } })).toEqual([1, 2, 4]);
    expect(ids({ lists: { preferredFoot: ["left"] } })).toEqual([2]);
    expect(ids({ lists: { positionGroup: [] } })).toEqual([1, 2, 3, 4]);
  });

  it("keeps the chosen leagues, clubs and nationalities", () => {
    expect(ids({ lists: { leagueId: [53] } })).toEqual([2]);
    expect(ids({ lists: { clubId: [10] } })).toEqual([1, 4]);
    expect(ids({ lists: { nationalityId: [37, 52] } })).toEqual([1, 2]);
  });

  // "All but the chosen": a player without a league is outside every chosen one, so he stays.
  it("keeps everyone but the chosen values of an excluded list", () => {
    expect(ids({ lists: { leagueId: [53] }, excludedLists: { leagueId: true } })).toEqual([
      1, 3, 4,
    ]);
    expect(
      ids({ lists: { positionGroup: ["goalkeeper"] }, excludedLists: { positionGroup: true } }),
    ).toEqual([1, 2, 4]);
    expect(ids({ lists: { clubId: [10] }, excludedLists: { leagueId: true } })).toEqual([1, 4]);
  });

  it("applies inclusive ranges, open at either end", () => {
    expect(ids({ ranges: { age: { min: 22, max: 26 } } })).toEqual([1, 2]);
    expect(ids({ ranges: { age: { max: 22 } } })).toEqual([2, 4]);
    expect(ids({ ranges: { potential: { min: 80 } } })).toEqual([2, 4]);
    expect(ids({ ranges: { overall: { min: 51, max: 62 } } })).toEqual([4]);
    expect(ids({ ranges: { growth: { min: 18, max: 20 } } })).toEqual([1, 3, 4]);
    expect(ids({ ranges: { height: { max: 170 } } })).toEqual([2]);
    expect(ids({ ranges: { age: {} } })).toEqual([1, 2, 3, 4]);
  });

  it("ranges attributes, all of them at once", () => {
    expect(ids({ ranges: { dribbling: { min: 90 }, finishing: { min: 90 } } })).toEqual([2]);
    expect(ids({ ranges: { dribbling: { min: 90 }, finishing: { min: 91 } } })).toEqual([]);
    expect(ids({ ranges: { dribbling: { max: 50 } } })).toEqual([1, 3, 4]);
  });

  it("ranges the price and the wage, never passing a player without them", () => {
    const players = [
      testPlayer({ id: 1, price: 0, wage: 0 }),
      testPlayer({ id: 2, price: 500_000, wage: 1200 }),
      testPlayer({ id: 3, price: null, wage: null }),
    ];
    const kept = (filters: PlayerFilters) =>
      filterPlayers(players, filters).map((player) => player.id);
    expect(kept({ ranges: { price: { min: 0 } } })).toEqual([1, 2]);
    expect(kept({ ranges: { price: { min: 1 } } })).toEqual([2]);
    expect(kept({ ranges: { price: { max: 0 } } })).toEqual([1]);
    expect(kept({ ranges: { wage: { min: 0 } } })).toEqual([1, 2]);
    expect(kept({ ranges: { wage: { min: 1 } } })).toEqual([2]);
    expect(kept({ ranges: { wage: { max: 1000 } } })).toEqual([1]);
  });

  it("ranges the years left on a contract, bounds included, without those who have no contract", () => {
    const players = [0, 3, null, 1].map((contractYearsLeft, index) =>
      testPlayer({ id: index + 1, contractYearsLeft }),
    );
    const kept = (range: { min?: number; max?: number }) =>
      filterPlayers(players, { ranges: { contractYearsLeft: range } }).map((player) => player.id);
    expect(kept({ min: 0, max: 1 })).toEqual([1, 4]);
    expect(kept({ min: 3 })).toEqual([2]);
    expect(kept({ max: 0 })).toEqual([1]);
  });

  it("leaves out players without the value when a range applies to it", () => {
    expect(ids({ ranges: { clubRating: { max: 99 } } })).toEqual([1, 2, 4]);
    expect(ids({ ranges: { contractEndYear: { max: 2012 } } })).toEqual([1, 4]);
    expect(ids({ ranges: { form: { min: 0 } } })).toEqual([4]);
  });

  it("ranges the OVR at a chosen position, whatever the preferred one", () => {
    const rated = ratedAtCode1();
    const at = (filters: PlayerFilters) => filterPlayers(rated, filters).map((player) => player.id);
    expect(at({ positionRating: { code: 1, min: 20, max: 30 } })).toEqual([2, 3]);
    expect(at({ positionRating: { code: 1 } })).toEqual([1, 2, 3, 4]);
    expect(at({ positionRating: { code: 2, max: 49 } })).toEqual([]);
    expect(at({ positionRating: { code: 40 } })).toEqual([]);
  });

  it("ranges the gain of the chosen position over the OVR", () => {
    const rated = ratedAtCode1(15);
    const at = (filters: PlayerFilters) => filterPlayers(rated, filters).map((player) => player.id);
    // Gains: -5, 5, 15, 25.
    expect(at({ positionRating: { code: 1, gain: { min: 0, max: 20 } } })).toEqual([2, 3]);
    expect(at({ positionRating: { code: 1, gain: { max: -1 } } })).toEqual([1]);
  });

  it("ranges the peak at the chosen position, which needs a career", () => {
    const rated = [1, 2, 3, 4].map((id) =>
      testPlayer({
        id,
        peakByCode: id === 4 ? [] : Array.from({ length: 32 }, (_, code) => code + id),
      }),
    );
    const at = (filters: PlayerFilters) => filterPlayers(rated, filters).map((player) => player.id);
    // Peaks at code 5: 6, 7, 8 and none for player 4, who has no career.
    expect(at({ positionRating: { code: 5, peak: { min: 7 } } })).toEqual([2, 3]);
    expect(at({ positionRating: { code: 5, peak: { max: 6 } } })).toEqual([1]);
    expect(at({ positionRating: { code: 6, peak: { max: 7 } } })).toEqual([1]);
  });

  it("requires a trait or its absence", () => {
    expect(ids({ flags: { playmaker: true } })).toEqual([2]);
    expect(ids({ flags: { playmaker: false } })).toEqual([1, 3, 4]);
    expect(ids({ flags: { playmaker: true, puncher: true } })).toEqual([]);
  });

  it("finds national team players and the transfer list", () => {
    expect(ids({ flags: { nationalTeam: true } })).toEqual([2]);
    // Owner, 2026-11-11 (NZP): the game's mark for a player who retires when the season ends.
    const retiring = [testPlayer({ id: 1, retiring: true }), testPlayer({ id: 2 })];
    const kept = (flag: boolean) =>
      filterPlayers(retiring, { flags: { retiring: flag } }).map((player) => player.id);
    expect([kept(true), kept(false)]).toEqual([[1], [2]]);
    expect(ids({ flags: { nationalTeam: false } })).toEqual([1, 3, 4]);
    expect(ids({ flags: { transferListed: true } })).toEqual([4]);
    expect(ids({ flags: { transferListed: false } })).toEqual([1, 2, 3]);
    // Without a career (null) a player does not count as one his club will sell.
    expect(ids({ flags: { clubWillSell: true } })).toEqual([4]);
    expect(ids({ flags: { clubWillSell: false } })).toEqual([1, 2, 3]);
  });

  it("keeps players by the game's shortlist and the user's own list", () => {
    const listed = [1, 2, 3, 4].map((id) => testPlayer({ id, shortlisted: id === 2 || id === 3 }));
    const myListIds = new Set([3, 4]);
    const onList = (membership: ListMembership, own?: ReadonlySet<number>) =>
      filterPlayers(listed, {
        onList: membership,
        ...(own === undefined ? {} : { myListIds: own }),
      }).map((player) => player.id);
    expect(onList("game", myListIds)).toEqual([2, 3]);
    expect(onList("tool", myListIds)).toEqual([3, 4]);
    expect(onList("both", myListIds)).toEqual([3]);
    expect(onList("none", myListIds)).toEqual([1]);
    // Without the own list's ids nobody is on it.
    expect(onList("tool")).toEqual([]);
    expect(onList("none")).toEqual([1, 4]);
  });

  // Without a stats row (null) a player never passes a range.
  it("keeps players by their league and cup games", () => {
    const games = [
      testPlayer({ id: 1, appearances: 3, cupAppearances: 2, assists: 1 }),
      testPlayer({ id: 2, appearances: 0, cupAppearances: 0, cleanSheets: 2 }),
      testPlayer({ id: 3 }),
    ];
    const kept = (filters: PlayerFilters) =>
      filterPlayers(games, filters).map((player) => player.id);
    expect(kept({ ranges: { cupAppearances: { min: 1 } } })).toEqual([1]);
    expect(kept({ ranges: { appearances: { max: 0 } } })).toEqual([2]);
    expect(kept({ ranges: { assists: { min: 1 } } })).toEqual([1]);
    expect(kept({ ranges: { cleanSheets: { min: 1 } } })).toEqual([2]);
  });

  // Without a career the peak, and so its gain, is null and never passes.
  it("keeps players by the growth left to their peak, bounds included", () => {
    const peaks = [
      testPlayer({ id: 1, peakGain: 0 }),
      testPlayer({ id: 2, peakGain: 5 }),
      testPlayer({ id: 3 }),
    ];
    const kept = (filters: PlayerFilters) =>
      filterPlayers(peaks, filters).map((player) => player.id);
    expect(kept({ ranges: { peakGain: { min: 5 } } })).toEqual([2]);
    expect(kept({ ranges: { peakGain: { max: 0 } } })).toEqual([1]);
  });

  it("ranges the peak and its gain at the best peak position while peakAtBest is on", () => {
    const peaks = [
      testPlayer({ id: 1, peak: 70, peakGain: 2, bestPeak: 80, bestPeakGain: 12 }),
      testPlayer({ id: 2, peak: 85, peakGain: 9, bestPeak: 85, bestPeakGain: 9 }),
      testPlayer({ id: 3 }),
    ];
    const kept = (filters: PlayerFilters) =>
      filterPlayers(peaks, filters).map((player) => player.id);
    expect(kept({ ranges: { peak: { min: 80 } } })).toEqual([2]);
    expect(kept({ ranges: { peak: { min: 80 } }, peakAtBest: true })).toEqual([1, 2]);
    expect(kept({ ranges: { peakGain: { min: 10 } } })).toEqual([]);
    expect(kept({ ranges: { peakGain: { min: 10 } }, peakAtBest: true })).toEqual([1]);
    expect(kept({ ranges: { peak: { min: 80 } }, peakAtBest: false })).toEqual([2]);
  });

  it("names the peak field of either mode", () => {
    expect(peakField("peak", true)).toBe("bestPeak");
    expect(peakField("bestPeakGain", false)).toBe("peakGain");
    expect(peakField("peakGain", false)).toBe("peakGain");
    expect(peakField("potential", true)).toBe("potential");
  });

  it("finds the players on loan and those listed for one", () => {
    expect(ids({ flags: { loaned: true } })).toEqual([2]);
    expect(ids({ flags: { loaned: false } })).toEqual([1, 3, 4]);
    expect(ids({ flags: { loanListed: true } })).toEqual([4]);
    expect(ids({ flags: { loanListed: false } })).toEqual([1, 2, 3]);
  });

  it("excludes a team", () => {
    expect(ids({ excludeTeamId: 10 })).toEqual([2, 3]);
  });

  it("counts academy youth as the user's club, whether it is hidden or the only one shown", () => {
    expect(idsWithClubless({ onlyTeamId: 10 })).toEqual([1, 4, 5]);
    expect(idsWithClubless({ excludeTeamId: 10 })).toEqual([2, 3, 6, 7, 8]);
  });

  it("counts the user's players on loan at another club as the user's", () => {
    const lent = testPlayer({ id: 9, name: "Lent", clubId: 20, loanedFromId: 10 });
    const borrowed = testPlayer({ id: 11, name: "Borrowed", clubId: 10, loanedFromId: 20 });
    const loanIds = (filters: PlayerFilters) =>
      filterPlayers([lent, borrowed], filters).map((player) => player.id);
    expect(loanIds({ onlyTeamId: 10 })).toEqual([9, 11]);
    expect(loanIds({ excludeTeamId: 10 })).toEqual([]);
    // Club 20 lent player 11 to club 10.
    expect(loanIds({ onlyTeamId: 20 })).toEqual([9, 11]);
  });

  it("keeps only players whose highest OVR is at the chosen position, a tie included", () => {
    const best = filterPlayers([ratedAt5(1, 70), ratedAt5(2, 60), ratedAt5(3, 59)], {
      positionRating: { code: 5, bestOnly: true },
    });
    expect(best.map((player) => player.id)).toEqual([1, 2]);
  });

  // 1 and 4 play for the user's club (10), 2 for another; 3 and 7 are free agents, 5 a junior of the
  // academy, 8 a scouted junior without a club, 6 linked only to a national team.
  it("keeps players by club status: available in a career, with a club, free or unavailable", () => {
    expect(status("available")).toEqual([1, 2, 3, 4, 5, 7, 8]);
    expect(status("with-club")).toEqual([1, 2, 4]);
    expect(status("free-agents")).toEqual([3, 7]);
    expect(status("unavailable")).toEqual([6]);
  });

  it("counts as unavailable in a career exactly those not available, all of them without a club", () => {
    const all = idsWithClubless({});
    const split = [
      ...idsWithClubless({ clubStatus: "available" }),
      ...idsWithClubless({ clubStatus: "unavailable" }),
    ];
    expect(split.toSorted((a, b) => a - b)).toEqual(all);
    expect(
      filterPlayers([...PLAYERS, ...CLUBLESS], { clubStatus: "unavailable" }).every(
        (player) => player.clubId === null && !player.freeAgent && !player.youth,
      ),
    ).toBe(true);
  });

  it("combines filters with AND", () => {
    expect(
      ids({
        ranges: { age: { max: 26 }, potential: { max: 75 } },
        lists: { clubId: [10] },
        flags: { playmaker: false },
      }),
    ).toEqual([1]);
  });
});

describe("rangedAttributes", () => {
  it("lists the attributes with a range, in the order they were added, without other ranges", () => {
    const ranges = {
      dribbling: { min: 70 },
      age: { max: 21 },
      acceleration: {},
      finishing: { max: 9 },
    };
    expect(rangedAttributes(ranges)).toEqual(["dribbling", "finishing"]);
    expect(rangedAttributes(undefined)).toEqual([]);
  });
});
