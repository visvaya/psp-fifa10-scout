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
    positionGroup: "wide",
    attributes: attributes(50, { dribbling: 97, finishing: 90 }),
    clubId: 241,
    leagueId: 53,
    contractEndYear: 2014,
    nationalityId: 52,
  }),
  testPlayer({
    id: 3,
    name: "Free Agent",
    age: 31,
    potential: 60,
    positionGroup: "goalkeeper",
    clubId: null,
    leagueId: null,
    contractEndYear: null,
  }),
  testPlayer({ id: 4, name: "Young", age: 17, potential: 80, contractEndYear: 2010 }),
];

const ids = (filters: PlayerFilters): readonly number[] =>
  filterPlayers(PLAYERS, filters).map((player) => player.id);

describe("filterPlayers", () => {
  it("returns everything for empty filters", () => {
    expect(ids({})).toEqual([1, 2, 3, 4]);
  });

  it("searches names ignoring case and diacritics", () => {
    expect(ids({ text: "  brozek " })).toEqual([1]);
    expect(ids({ text: "MES" })).toEqual([2]);
    expect(ids({ text: "  " })).toEqual([1, 2, 3, 4]);
  });

  it("keeps the chosen position groups", () => {
    expect(ids({ positionGroups: ["wide", "goalkeeper"] })).toEqual([2, 3]);
    expect(ids({ positionGroups: [] })).toEqual([1, 2, 3, 4]);
  });

  it("applies inclusive age and potential ranges, open at either end", () => {
    expect(ids({ age: { min: 22, max: 26 } })).toEqual([1, 2]);
    expect(ids({ age: { max: 22 } })).toEqual([2, 4]);
    expect(ids({ potential: { min: 80 } })).toEqual([2, 4]);
  });

  it("requires every attribute minimum", () => {
    expect(ids({ attributeMin: { dribbling: 90, finishing: 90 } })).toEqual([2]);
    expect(ids({ attributeMin: { dribbling: 90, finishing: 91 } })).toEqual([]);
    expect(ids({ attributeMin: { dribbling: 50 } })).toEqual([1, 2, 3, 4]);
  });

  it("keeps the chosen leagues, teams and nationalities", () => {
    expect(ids({ leagueIds: [53] })).toEqual([2]);
    expect(ids({ teamIds: [10] })).toEqual([1, 4]);
    expect(ids({ nationalityIds: [37, 52] })).toEqual([1, 2]);
    expect(ids({ leagueIds: [] })).toEqual([1, 2, 3, 4]);
  });

  it("finds contracts ending by a year, free agents and excludes a team", () => {
    expect(ids({ contractEndsBy: 2012 })).toEqual([1, 4]);
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
    expect(ids({ age: { max: 26 }, teamIds: [10], potential: { max: 75 } })).toEqual([1]);
  });
});
