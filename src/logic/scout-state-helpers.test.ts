// The helpers the screens read from the scout state: the filters the list shows as chips, the colour
// bands and the facet options.
import { describe, expect, it } from "vitest";
import { activeFilters, attributeBand, facetOptions } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

describe("activeFilters", () => {
  it("lists each filter that narrows the list", () => {
    expect(
      activeFilters({
        text: " ",
        ranges: { age: { min: 18 }, potential: {}, finishing: { max: 0 } },
        clubStatus: "available",
      }),
    ).toEqual(["ranges.age", "ranges.finishing"]);
    expect(
      activeFilters({
        myClub: "hide",
        clubStatus: "free-agents",
        text: "a",
        lists: { leagueId: [1], clubId: [] },
        flags: { selfish: false, transferListed: undefined },
      }),
    ).toEqual(["text", "lists.leagueId", "flags.selfish", "clubStatus", "myClub"]);
  });
});

describe("attributeBand", () => {
  it("bands values at 80, 70 and 50", () => {
    expect([99, 80, 79, 70, 69, 50, 49, 1].map((value) => attributeBand(value))).toEqual([
      "high",
      "high",
      "good",
      "good",
      "average",
      "average",
      "low",
      "low",
    ]);
  });
});

describe("facetOptions", () => {
  it("lists leagues, clubs (within the chosen leagues) and nationalities in Polish order", () => {
    const players = [
      testPlayer({ id: 1, leagueId: 2, leagueName: "Łotwa", clubId: 5, clubName: "Śląsk" }),
      testPlayer({
        id: 2,
        leagueId: 1,
        leagueName: "Liga",
        clubId: 6,
        clubName: "Sokół",
        contractEndYear: 2011,
      }),
      testPlayer({
        id: 3,
        leagueId: null,
        leagueName: null,
        clubId: null,
        clubName: null,
        nationalityId: 9,
        nationalityName: null,
        contractEndYear: null,
      }),
    ];
    const all = facetOptions(players, {});
    expect(all.leagues).toEqual([
      { id: 1, name: "Liga" },
      { id: 2, name: "Łotwa" },
    ]);
    expect(all.clubs.map((club) => club.name)).toEqual(["Sokół", "Śląsk"]);
    expect(all.nationalities).toEqual([{ id: 1, name: "Country" }]);
    expect(all.contractYears).toEqual([2011, 2012]);
    expect(all.codes).toEqual({
      positionCode: [17],
      bodyType: [2],
      developmentType: [1],
      developmentStyle: [2],
    });
    expect(facetOptions(players, { lists: { leagueId: [2] } }).clubs).toEqual([
      { id: 5, name: "Śląsk" },
    ]);
  });

  it("orders names with the given collation", () => {
    const players = [
      testPlayer({ id: 1, clubId: 1, clubName: "Hradec" }),
      testPlayer({ id: 2, clubId: 2, clubName: "Chrudim" }),
    ];
    const names = (collator?: Intl.Collator) =>
      facetOptions(players, {}, collator).clubs.map((club) => club.name);
    expect(names()).toEqual(["Chrudim", "Hradec"]);
    expect(names(new Intl.Collator("cs"))).toEqual(["Hradec", "Chrudim"]);
  });
});
