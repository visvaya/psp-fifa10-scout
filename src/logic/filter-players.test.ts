import { describe, expect, it } from "vitest";
import { filterPlayers } from "./filter-players.ts";
import type { PlayerFilters } from "./filter-players.ts";
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
    positionGroup: "wide",
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
  }),
  testPlayer({
    id: 3,
    name: "Free Agent",
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
  }),
];

const ids = (filters: PlayerFilters): readonly number[] =>
  filterPlayers(PLAYERS, filters).map((player) => player.id);

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
    expect(ids({ lists: { positionGroup: ["wide", "goalkeeper"] } })).toEqual([2, 3]);
    expect(ids({ lists: { positionCode: [14, 17] } })).toEqual([1, 2, 4]);
    expect(ids({ lists: { preferredFoot: ["left"] } })).toEqual([2]);
    expect(ids({ lists: { positionGroup: [] } })).toEqual([1, 2, 3, 4]);
  });

  it("keeps the chosen leagues, clubs and nationalities", () => {
    expect(ids({ lists: { leagueId: [53] } })).toEqual([2]);
    expect(ids({ lists: { clubId: [10] } })).toEqual([1, 4]);
    expect(ids({ lists: { nationalityId: [37, 52] } })).toEqual([1, 2]);
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

  it("leaves out players without the value when a range applies to it", () => {
    expect(ids({ ranges: { clubRating: { max: 99 } } })).toEqual([1, 2, 4]);
    expect(ids({ ranges: { contractEndYear: { max: 2012 } } })).toEqual([1, 4]);
    expect(ids({ ranges: { form: { min: 0 } } })).toEqual([4]);
  });

  it("requires a trait or its absence", () => {
    expect(ids({ flags: { playmaker: true } })).toEqual([2]);
    expect(ids({ flags: { playmaker: false } })).toEqual([1, 3, 4]);
    expect(ids({ flags: { playmaker: true, puncher: true } })).toEqual([]);
  });

  it("finds national team players and the transfer list", () => {
    expect(ids({ flags: { nationalTeam: true } })).toEqual([2]);
    expect(ids({ flags: { nationalTeam: false } })).toEqual([1, 3, 4]);
    expect(ids({ flags: { transferListed: true } })).toEqual([4]);
    expect(ids({ flags: { transferListed: false } })).toEqual([1, 2, 3]);
  });

  it("finds free agents and excludes a team", () => {
    expect(ids({ freeAgentsOnly: true })).toEqual([3]);
    expect(ids({ freeAgentsOnly: false })).toEqual([1, 2, 3, 4]);
    expect(ids({ excludeTeamId: 10 })).toEqual([2, 3]);
  });

  it("does not count an academy youth player without a club as a free agent", () => {
    const academy = testPlayer({
      id: 5,
      name: "Academy",
      clubId: null,
      leagueId: null,
      youth: true,
    });
    expect(
      filterPlayers([...PLAYERS, academy], { freeAgentsOnly: true }).map((player) => player.id),
    ).toEqual([3]);
  });

  it("hides clubless players except academy youth when only players with a club are wanted", () => {
    const academy = testPlayer({ id: 5, name: "Academy", clubId: null, youth: true });
    expect(
      filterPlayers([...PLAYERS, academy], { withClubOnly: true }).map((player) => player.id),
    ).toEqual([1, 2, 4, 5]);
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
