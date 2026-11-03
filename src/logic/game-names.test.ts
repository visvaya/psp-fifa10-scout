import { describe, expect, it } from "vitest";
import { countryKey, leagueKey, teamKey } from "../data/game-locale.ts";
import {
  collatorFor,
  defaultLanguage,
  gameNamesOf,
  languageLabel,
  localizePlayers,
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
]);

describe("gameNamesOf", () => {
  it("names teams, leagues with their country and countries, skipping missing keys", () => {
    expect(
      gameNamesOf(TABLE, { teams: [21, 1353, 5], leagues: [19, 76, 7, 8], countries: [37, 0] }),
    ).toStrictEqual({
      teams: { 21: "Bayern Monachium", 1353: "Polska" },
      leagues: { 19: "Bundesliga (Niemcy)", 76: "Reszta Świata" },
      countries: { 37: "Polska" },
    });
  });
});

describe("localizePlayers", () => {
  const names = {
    teams: { 21: "Bayern Monachium", 1353: "Polska" },
    leagues: { 19: "Bundesliga (Niemcy)" },
    countries: { 37: "Polska" },
  };

  it("replaces the club, league, national team and nationality names it knows", () => {
    const players = [
      testPlayer({
        clubId: 21,
        leagueId: 19,
        nationalTeamId: 1353,
        nationalTeamName: "Poland",
        nationalityId: 37,
      }),
      testPlayer({ id: 2, clubId: 5, clubName: "Other", leagueId: 7, nationalityId: 9 }),
    ];
    const [known, unknown] = localizePlayers(players, names);
    expect(known).toMatchObject({
      clubName: "Bayern Monachium",
      leagueName: "Bundesliga (Niemcy)",
      nationalTeamName: "Polska",
      nationalityName: "Polska",
    });
    expect(unknown).toEqual(players[1]);
  });

  it("keeps clubless players clubless and returns the players unchanged without names", () => {
    const players = [
      testPlayer({ clubId: null, clubName: null, leagueId: null, leagueName: null }),
    ];
    expect(localizePlayers(players, names)[0]).toMatchObject({ clubName: null, leagueName: null });
    expect(localizePlayers(players, null)).toBe(players);
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
