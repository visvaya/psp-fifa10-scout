import { describe, expect, it } from "vitest";
import { countryKey, labelKey, leagueKey, teamKey, textKey } from "../data/game-locale.ts";
import {
  collatorFor,
  defaultLanguage,
  gameNamesOf,
  languageLabel,
  localizePlayers,
  positionNameIn,
} from "./game-names.ts";
import { nameCollator } from "./players.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

const TABLE = new Map([
  [teamKey(21, 0), "Bayern Monachium"],
  [teamKey(21, 1), "Bayern"],
  [teamKey(1353, 0), "Polska"],
  [leagueKey(19, 0), "Bundesliga"],
  [leagueKey(19, 3), "Niemcy"],
  [leagueKey(76, 0), "Reszta Świata"],
  [leagueKey(8, 3), "Kraj bez ligi"],
  [countryKey(37), "Polska"],
  [labelKey("GK"), "BR"],
  [labelKey("RCDM"), "PŚPD"],
  [textKey(1592), "Bramkarz"],
  [textKey(1621), "Czyściciel pola"],
]);

describe("gameNamesOf", () => {
  it("names teams, leagues with their country and countries, skipping missing keys", () => {
    expect(
      gameNamesOf(TABLE, { teams: [21, 1353, 5], leagues: [19, 76, 7, 8], countries: [37, 0] }),
    ).toStrictEqual({
      teams: { 21: "Bayern Monachium", 1353: "Polska" },
      leagues: { 19: "Bundesliga (Niemcy)", 76: "Reszta Świata" },
      countries: { 37: "Polska" },
      positions: { 0: "BR", 10: "PŚPD" },
      positionNames: { 0: "Bramkarz", 1: "Czyściciel pola" },
    });
  });
});

describe("positionNameIn", () => {
  it("names a position in the game language, else by the game's English name", () => {
    const names = {
      teams: {},
      leagues: {},
      countries: {},
      positions: { 0: "BR" },
      positionNames: {},
    };
    expect(positionNameIn(names, 0)).toBe("BR");
    expect(positionNameIn(names, 10)).toBe("RCDM");
    expect(positionNameIn(null, 0)).toBe("GK");
  });

  it("adds the English name where the abbreviation is another position's English one", () => {
    const names = {
      teams: {},
      leagues: {},
      countries: {},
      // Polish: ST is the sweeper (English ST: striker), LS the left winger (English LS: left striker).
      positions: { 1: "ST", 20: "LS", 30: "N", 31: "LN" },
      positionNames: {},
    };
    expect([1, 20, 30, 31].map((code) => positionNameIn(names, code))).toEqual([
      "ST (ang. SW)",
      "LS (ang. LWM)",
      "N",
      "LN",
    ]);
  });

  it("adds the English name where the language gives two positions one abbreviation", () => {
    const names = {
      teams: {},
      leagues: {},
      countries: {},
      positions: { 26: "PN", 29: "PN" },
      positionNames: {},
    };
    expect(positionNameIn(names, 26)).toBe("PN (ang. RF)");
    expect(positionNameIn(names, 29)).toBe("PN (ang. RS)");
    const partial = {
      teams: {},
      leagues: {},
      countries: {},
      positions: { 20: "LS" },
      positionNames: {},
    };
    expect(positionNameIn(partial, 20)).toBe("LS (ang. LWM)");
    expect(positionNameIn(partial, 31)).toBe("LS");
  });
});

describe("localizePlayers", () => {
  const names = {
    teams: { 21: "Bayern Monachium", 1353: "Polska" },
    leagues: { 19: "Bundesliga (Niemcy)" },
    countries: { 37: "Polska" },
    positions: { 17: "ŚP" },
    positionNames: {},
  };

  it("replaces the club, league, national team, nationality and position names it knows", () => {
    const players = [
      testPlayer({
        clubId: 21,
        leagueId: 19,
        nationalTeamId: 1353,
        nationalTeamName: "Poland",
        nationalityId: 37,
        positionCode: 17,
      }),
      testPlayer({
        id: 2,
        clubId: 5,
        clubName: "Other",
        leagueId: 7,
        nationalityId: 9,
        positionCode: 0,
        positionName: "GK",
      }),
    ];
    const [known, unknown] = localizePlayers(players, names);
    expect(known).toMatchObject({
      clubName: "Bayern Monachium",
      leagueName: "Bundesliga (Niemcy)",
      nationalTeamName: "Polska",
      nationalityName: "Polska",
      positionName: "ŚP",
    });
    expect(unknown).toEqual(players[1]);
  });

  it("names a misleading position with its English name in the list and on the card too", () => {
    const polish = { ...names, positions: { 1: "ST", 30: "N" } };
    const [sweeper] = localizePlayers(
      [testPlayer({ positionCode: 1, positionName: "SW" })],
      polish,
    );
    expect(sweeper?.positionName).toBe("ST (ang. SW)");
  });

  it("keeps clubless players clubless and returns the players unchanged without names", () => {
    const players = [
      testPlayer({ clubId: null, clubName: null, leagueId: null, leagueName: null }),
    ];
    expect(localizePlayers(players, names)[0]).toMatchObject({ clubName: null, leagueName: null });
    expect(localizePlayers(players, null)).toBe(players);
  });

  it("orders player names in the language's collation", () => {
    const players = [
      testPlayer({ id: 1, name: "Hrubý", nameOrder: 1 }),
      testPlayer({ id: 2, name: "Chalupa", nameOrder: 0 }),
    ];
    const czech = localizePlayers(players, null, collatorFor("cze_cz"));
    expect(czech.map((player) => [player.id, player.nameOrder])).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(localizePlayers(players, null, nameCollator)).toBe(players);
  });
});

describe("languages", () => {
  it("labels the known languages and shows others by code", () => {
    expect(languageLabel("pol_pl")).toBe("Polski");
    expect(languageLabel("cze_cz")).toBe("Čeština");
    expect(languageLabel("hun_hu")).toBe("Magyar");
    expect(languageLabel("eng_us")).toBe("English");
    expect(languageLabel("ger_de")).toBe("ger_de");
  });

  it("picks the game language matching the browser, else none", () => {
    const codes = ["ger_de", "cze_cz", "eng_us", "pol_pl"];
    expect(defaultLanguage(codes, ["pl-PL", "en"])).toBe("pol_pl");
    expect(defaultLanguage(codes, ["de-DE", "cs"])).toBe("cze_cz");
    expect(defaultLanguage(codes, ["de-DE"])).toBeNull();
    expect(defaultLanguage([], ["pl"])).toBeNull();
  });

  it("collates in the language's order, Polish for the fifa.db names", () => {
    const words = ["Ch", "H", "Ł", "M"];
    expect(words.toSorted(collatorFor("cze_cz").compare)).toEqual(["H", "Ch", "Ł", "M"]);
    expect(words.toSorted(collatorFor(null).compare)).toEqual(["Ch", "H", "Ł", "M"]);
    expect(collatorFor(null)).toBe(nameCollator);
    expect(collatorFor("ger_de")).toBe(nameCollator);
  });
});
