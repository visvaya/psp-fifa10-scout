import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import { filterPlayers } from "./filter-players.ts";
import { attributesOf, buildPlayers, searchKey } from "./players.ts";
import { sortPlayers } from "./sort-players.ts";
import { baseOverall, byPositionCode } from "./overall-rating.ts";
import { byGroup } from "./positions.ts";
import { attributes, flatCurves, playerRow, table } from "./test-support/player-fixtures.ts";

const daysSince1582 = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1582, 9, 14)) / 86_400_000;

const BORN_1989_07_10 = daysSince1582(1989, 7, 10);

const DB = parseEaDb(
  buildEaDb([
    table("leagues", [
      { leagueid: 53, leaguename: "Spain Primera Division (1)", level: 1 },
      { leagueid: 76, leaguename: "Rest of World", level: 4 },
      { leagueid: 78, leaguename: "International", level: 5 },
      { leagueid: 2028, leaguename: "World League", level: 7 },
    ]),
    table("teams", [
      { teamid: 241, teamname: "FC Barcelona", overallrating: 84 },
      { teamid: 1873, teamname: "Wisła Kraków", overallrating: 66 },
      { teamid: 1369, teamname: "Argentina", overallrating: 83 },
      { teamid: 9999, teamname: "All Stars", overallrating: 90 },
      { teamid: 5000, teamname: "Unlisted", overallrating: 50 },
    ]),
    table("leagueteamlinks", [
      { leagueid: 53, teamid: 241 },
      { leagueid: 76, teamid: 1873 },
      { leagueid: 78, teamid: 1369 },
      { leagueid: 2028, teamid: 9999 },
    ]),
    table("country", [
      { countryid: 52, countryname: "Argentina" },
      { countryid: 37, countryname: "Poland" },
    ]),
    // Data rows, alike by nature. jscpd:ignore-start
    table("players", [
      playerRow({
        playerid: 158_023,
        firstname: "Lionel",
        surname: "Messi",
        nationality: 52,
        preferredposition1: 14,
        preferredfoot: 1,
        height: 169,
        weight: 67,
        potential: 95,
        acceleration: 94,
        reflexes: 9,
        crossing: 90,
        bodysizecode: 1,
        weakfootability: 3,
        internationalreputation: 5,
        learningspeed: 4,
        retirementage: 36,
        developmenttypecode: 3,
        developmentstylecode: 5,
        technicaldribbler: 1,
        playmaker: 1,
      }),
      playerRow({
        playerid: 7,
        firstname: "",
        surname: " Ronaldinho ",
        nationality: 37,
        birthdate: BORN_1989_07_10,
        preferredposition1: 12,
      }),
      playerRow({ playerid: 8, nationality: 37, preferredposition1: 24 }),
      playerRow({ playerid: 400_001, nationality: 37 }),
      playerRow({ playerid: 400_002, nationality: 37, preferredposition1: 30 }),
      playerRow({ playerid: 400_003, nationality: 37 }),
      playerRow({ playerid: 400_004, nationality: 37 }),
    ]),
    // jscpd:ignore-end
    table("teamplayerlinks", [
      { teamid: 9999, playerid: 158_023, jerseynumber: 1, yearcontractvalidtil: 2020 },
      { teamid: 241, playerid: 158_023, jerseynumber: 10, yearcontractvalidtil: 2014 },
      { teamid: 1369, playerid: 158_023, jerseynumber: 19, yearcontractvalidtil: 2014 },
      { teamid: 241, playerid: 7, jerseynumber: 30, yearcontractvalidtil: 2011 },
      { teamid: 5000, playerid: 8, jerseynumber: 4, yearcontractvalidtil: 2013 },
    ]),
    table("career_players_grown_attributes", [{ playerid: 0, potential_delta: 0 }]),
    flatCurves(),
  ]),
);

const row = (values: Readonly<Record<string, number | string>>): EaDbRow => Object.freeze(values);

const SAVE: CareerSave = new Map([
  [
    "team_manager",
    [
      row({ team_id: -1, firstname: "", surname: "", last_game_number: 0 }),
      row({
        team_id: 1873,
        firstname: "Nowy",
        surname: "Kariera",
        last_game_number: daysSince1582(2009, 7, 25) * 1024 + 3,
      }),
    ],
  ],
  [
    "teamplayerlinks",
    [
      row({ teamid: 241, playerid: 158_023, jerseynumber: 10, yearcontractvalidtil: 2014 }),
      row({ teamid: 1873, playerid: 7, jerseynumber: 9, yearcontractvalidtil: 2012 }),
      row({ teamid: 1873, playerid: 400_002, jerseynumber: 40, yearcontractvalidtil: 2013 }),
      row({ teamid: 111_259, playerid: 8, jerseynumber: 2, yearcontractvalidtil: 2005 }),
    ],
  ],
  ["career_youth_accademy", [row({ playerid: 400_001, dummy: 0 })]],
  ["career_transfer_list", [row({ playerid: 400_003 })]],
  ["career_players_grown_attributes", [row({ playerid: 7, potential_delta: -25 })]],
  ["career_extra_user_team_info", []],
  [
    "playerstats",
    [
      row({
        playerid: 158_023,
        form: 3,
        morale: 4,
        goals: 12,
        appearances: 20,
        injurydaysout: 14,
      }),
    ],
  ],
]);

const MESSI_ATTRIBUTES = attributes(50, { acceleration: 94, reflexes: 9, crossing: 90 });

const byId = (players: ReturnType<typeof buildPlayers>, id: number) =>
  players.find((player) => player.id === id);

describe("buildPlayers from fifa.db", () => {
  // Built per test, not in the describe body: Stryker credits only code run inside a test.
  let players: ReturnType<typeof buildPlayers> = [];
  beforeEach(() => {
    players = buildPlayers(DB);
  });

  it("summarises a club player with his club, league, national team and nationality", () => {
    // The full summary, alike the fixture's by nature. jscpd:ignore-start
    expect(byId(players, 158_023)).toEqual({
      id: 158_023,
      name: "Lionel Messi",
      searchName: "lionel messi",
      nameOrder: 1,
      youth: false,
      freeAgent: false,
      age: 22,
      positionCode: 14,
      positionName: "RWM",
      positionGroup: "wingers",
      preferredFoot: "left",
      height: 169,
      weight: 67,
      potential: 95,
      overall: 60,
      growth: 35,
      bodyType: 1,
      weakFoot: 4,
      internationalReputation: 5,
      learningSpeed: 4,
      retirementAge: 36,
      developmentType: 3,
      developmentStyle: 5,
      traits: ["playmaker", "technicaldribbler"],
      overallByGroup: {
        ...byGroup(() => 50),
        goalkeeper: 41,
        "side-midfield": 60,
        wingers: 60,
        "wing-backs": 54,
      },
      overallByCode: byPositionCode((code) => baseOverall(MESSI_ATTRIBUTES, code)),
      attributes: MESSI_ATTRIBUTES,
      clubId: 241,
      clubName: "FC Barcelona",
      clubRating: 84,
      leagueId: 53,
      leagueName: "Spain Primera Division (1)",
      contractEndYear: 2014,
      jerseyNumber: 10,
      nationalTeamId: 1369,
      nationalTeamName: "Argentina",
      nationalityId: 52,
      nationalityName: "Argentina",
      form: null,
      morale: null,
      goals: null,
      appearances: null,
      injuryDays: null,
      transferListed: false,
      price: null,
      wage: null,
      wageMax: null,
    });
    // jscpd:ignore-end
  });

  it("trims one-name players and names the centre-left positions as the game does", () => {
    expect(byId(players, 7)).toMatchObject({
      name: "Ronaldinho",
      nameOrder: 2,
      age: 19,
      positionName: "LCDM",
      positionGroup: "defensive-midfield",
      preferredFoot: "right",
      clubName: "FC Barcelona",
      nationalTeamId: null,
    });
    expect(byId(players, 8)).toMatchObject({
      positionName: "LCAM",
      positionGroup: "attacking-midfield",
    });
  });

  it("leaves a player whose only team has no league without a club, not a free agent", () => {
    expect(byId(players, 8)).toMatchObject({
      freeAgent: false,
      clubId: null,
      clubName: null,
      clubRating: null,
      leagueId: null,
      leagueName: null,
      contractEndYear: null,
      jerseyNumber: null,
    });
  });

  it("leaves out the youth pool without a team link and freezes the summaries", () => {
    expect(players.map((player) => player.id)).toEqual([158_023, 7, 8]);
    expect(Object.isFrozen(players)).toBe(true);
    expect(players.every((player) => Object.isFrozen(player))).toBe(true);
    expect(Object.isFrozen(players[0]?.attributes)).toBe(true);
  });
});

describe("searchKey", () => {
  it("drops case and diacritics, ł included", () => {
    expect(searchKey("Paweł ŻURAWSKI Łoś")).toBe("pawel zurawski los");
  });
});

describe("attributesOf", () => {
  it("rejects a players row without every attribute column", () => {
    const { reflexes: _, ...partial } = playerRow({});
    expect(() => attributesOf(partial)).toThrow(/lack attribute columns/);
  });
});

describe("buildPlayers with a career save", () => {
  // Built per test, not in the describe body: Stryker credits only code run inside a test.
  let players: ReturnType<typeof buildPlayers> = [];
  beforeEach(() => {
    players = buildPlayers(DB, SAVE);
  });

  it("takes ages on the last game date and links from the save", () => {
    expect(byId(players, 7)).toMatchObject({
      age: 20,
      clubId: 1873,
      clubName: "Wisła Kraków",
      leagueName: "Rest of World",
      jerseyNumber: 9,
      contractEndYear: 2012,
    });
    expect(byId(players, 158_023)).toMatchObject({ nationalTeamId: null, clubId: 241 });
  });

  it("marks the players the save links to the game's free-agent team", () => {
    expect(byId(players, 8)).toMatchObject({ freeAgent: true, clubId: null, clubName: null });
    expect(byId(players, 7)?.freeAgent).toBe(false);
  });

  it("includes youth-pool players the save places in a team, the academy or the transfer list", () => {
    expect(players.map((player) => [player.id, player.youth])).toEqual([
      [158_023, false],
      [7, false],
      [8, false],
      [400_001, true],
      [400_002, true],
      [400_003, true],
    ]);
    expect(byId(players, 400_002)).toMatchObject({ positionName: "ST", positionGroup: "forwards" });
  });

  it("rates players in career mode, capped at the career potential", () => {
    expect(byId(players, 158_023)?.overall).toBe(60);
    expect(byId(players, 7)).toMatchObject({ overall: 45, overallByGroup: { goalkeeper: 45 } });
    expect(byId(players, 7)?.overallByCode[0]).toBe(45);
  });

  it("adds career stats where the save has them", () => {
    expect(byId(players, 158_023)).toMatchObject({
      form: 3,
      morale: 4,
      goals: 12,
      appearances: 20,
      injuryDays: 14,
    });
    expect(byId(players, 7)).toMatchObject({
      form: null,
      morale: null,
      goals: null,
      appearances: null,
      injuryDays: null,
    });
  });

  it("marks the players on the save's transfer list", () => {
    expect(players.filter((player) => player.transferListed).map((player) => player.id)).toEqual([
      400_003,
    ]);
  });
});

// Game data never enters the repository. FIFA_DB_PATH and PSP_CAREER_SAVE (plain DATA.BIN) point at
// local copies.
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const realCareerPath = process.env["PSP_CAREER_SAVE"] ?? "";

const realDb = () => parseEaDb(readFileSync(realDbPath));

const timed = <T>(label: string, run: () => T): T => {
  const start = performance.now();
  const result = run();
  process.stdout.write(`${label}: ${(performance.now() - start).toFixed(1)} ms\n`);
  return result;
};

describe.runIf(existsSync(realDbPath))("real fifa.db", () => {
  it("builds every linked player", () => {
    const players = timed("buildPlayers", () => buildPlayers(realDb()));
    expect(players).toHaveLength(13_045);
    expect(players.find((player) => player.name === "Lionel Messi")).toMatchObject({
      clubName: "FC Barcelona",
      leagueName: "Spain Primera Division (1)",
      nationalityName: "Argentina",
      age: 22,
      potential: 95,
    });
    expect(players.find((player) => player.name === "Robert Lewandowski")?.clubName).toBe(
      "Lech Poznań",
    );
    const filtered = timed("filterPlayers", () =>
      filterPlayers(players, {
        text: "a",
        lists: { positionGroup: ["forwards", "wingers", "attacking-midfield"], bodyType: [1, 2] },
        ranges: { age: { min: 18, max: 30 }, sprintspeed: { min: 60 }, height: { min: 170 } },
        flags: { injuryprone: false, technicaldribbler: true },
      }),
    );
    timed("sortPlayers all by name", () => sortPlayers(players, "name", "ascending"));
    timed("sortPlayers all by age", () => sortPlayers(players, "age", "descending"));
    timed("filter + sort by position rating", () =>
      sortPlayers(
        filterPlayers(players, { positionRating: { code: 3, min: 50 }, availableOnly: true }),
        "positionRating",
        "descending",
        { ratingCode: 3 },
      ),
    );
    timed("filter + sort", () =>
      sortPlayers(
        filterPlayers(players, { ranges: { potential: { min: 60 } }, flags: { selfish: false } }),
        "clubName",
        "ascending",
      ),
    );
    expect(filtered.length).toBeGreaterThan(0);
  });

  it.runIf(existsSync(realCareerPath))("builds the career's players", () => {
    const db = realDb();
    const players = buildPlayers(db, parseCareerSave(db, readFileSync(realCareerPath)));
    expect(players.filter((player) => player.clubName === "Wisła Kraków")).toHaveLength(23);
    expect(players.filter((player) => player.youth)).toHaveLength(3);
  });
});
