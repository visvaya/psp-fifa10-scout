import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import { NO_BEST_PEAK } from "./best-peak.ts";
import { filterPlayers } from "./filter-players.ts";
import { teamFields } from "./placements.ts";
import { NO_FINANCE } from "./player-finance.ts";
import { buildPlayers } from "./players.ts";
import { sortPlayers } from "./sort-players.ts";
import { baseOverall, byPositionCode } from "./overall-rating.ts";
import {
  attributes,
  flatCurves,
  grownRow,
  NO_STATS,
  playerRow,
  table,
} from "./test-support/player-fixtures.ts";

const daysSince1582 = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1582, 9, 14)) / 86_400_000;

const BORN_1989_07_10 = daysSince1582(1989, 7, 10);

const DB = parseEaDb(
  buildEaDb([
    table("leagues", [
      { leagueid: 53, leaguename: "Spain Primera Division (1)", level: 1, leagueprestige: 5 },
      { leagueid: 76, leaguename: "Rest of World", level: 4, leagueprestige: 5 },
      { leagueid: 78, leaguename: "International", level: 5, leagueprestige: 5 },
      { leagueid: 2028, leaguename: "World League", level: 7, leagueprestige: 5 },
    ]),
    table("teams", [
      { teamid: 241, teamname: "FC Barcelona", overallrating: 84, internationalprestige: 5 },
      { teamid: 1873, teamname: "Wisła Kraków", overallrating: 66, internationalprestige: 5 },
      { teamid: 1369, teamname: "Argentina", overallrating: 83, internationalprestige: 5 },
      { teamid: 9999, teamname: "All Stars", overallrating: 90, internationalprestige: 5 },
      { teamid: 5000, teamname: "Unlisted", overallrating: 50, internationalprestige: 5 },
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
      playerRow({
        playerid: 8,
        firstname: " Jan ",
        surname: " Kowalski ",
        nationality: 37,
        preferredposition1: 24,
      }),
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

/** A euro career with no prestige and no staff upgrades. */
const NO_UPGRADES = { currency: 0, prestige: 0, upgrade_fin: 0 };

const SAVE: CareerSave = new Map([
  [
    "team_manager",
    [
      row({ team_id: -1, firstname: "", surname: "", last_game_number: 0, ...NO_UPGRADES }),
      row({
        team_id: 1873,
        firstname: "Nowy",
        surname: "Kariera",
        last_game_number: daysSince1582(2009, 7, 25) * 1024 + 3,
        ...NO_UPGRADES,
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
  ["career_transfer_list", [row({ playerid: 400_003, is_loan: 0, sold: 0 })]],
  // 400_004: a scouted junior on the shortlist, not signed and in no team.
  ["career_shortlist", [158_023, 400_004].map((playerid) => row({ playerid, shortlist_dummy: 0 }))],
  ["career_players_grown_attributes", [row(grownRow(7, { potential_delta: -25 }))]],
  ["career_extra_user_team_info", []],
  [
    "playerstats",
    [
      row({
        playerid: 158_023,
        form: 69,
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
      initialName: "L. Messi",
      searchName: "lionel messi",
      nameOrder: 1,
      youth: false,
      academy: false,
      freeAgent: false,
      age: 22,
      seasonAge: 22,
      birthYear: 1987,
      positionCode: 14,
      positionName: "RWM",
      positionGroup: "wingers",
      preferredFoot: "left",
      height: 169,
      weight: 67,
      potential: 95,
      peak: null,
      peakGain: null,
      ...NO_BEST_PEAK,
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
      overallByCode: byPositionCode((code) => baseOverall(MESSI_ATTRIBUTES, code)),
      peakByCode: [],
      attributes: MESSI_ATTRIBUTES,
      clubId: 241,
      clubName: "FC Barcelona",
      clubRating: 84,
      // Messi (60) and Ronaldinho share Barcelona's squad.
      clubStars: 1,
      leaguePrestige: 5,
      clubPrestige: 5,
      leagueId: 53,
      leagueName: "Spain Primera Division (1)",
      contractEndYear: 2014,
      // Without a career, counted from the season the database starts (2009).
      contractYearsLeft: 5,
      jerseyNumber: 10,
      nationalTeamId: 1369,
      nationalTeamName: "Argentina",
      nationalityId: 52,
      nationalityName: "Argentina",
      ...NO_STATS,
      transferListed: false,
      loanListed: false,
      loanedFromId: null,
      loanedFromName: null,
      loanedFromRating: null,
      shortlisted: false,
      clubWillSell: null,
      saleRefusal: null,
      ...NO_FINANCE,
    });
    // jscpd:ignore-end
  });

  it("trims one-name players and names the centre-left positions as the game does", () => {
    expect(byId(players, 7)).toMatchObject({
      name: "Ronaldinho",
      // One name: nothing to shorten.
      initialName: null,
      nameOrder: 2,
      age: 19,
      positionName: "LCDM",
      positionGroup: "defensive-midfield",
      preferredFoot: "right",
      clubName: "FC Barcelona",
      nationalTeamId: null,
    });
    expect(byId(players, 8)).toMatchObject({
      // Both parts trimmed before they are joined and shortened.
      name: "Jan Kowalski",
      initialName: "J. Kowalski",
      searchName: "jan kowalski",
      positionName: "LCAM",
      positionGroup: "attacking-midfield",
    });
  });

  it("leaves a player whose only team has no league without a club, not a free agent", () => {
    expect(byId(players, 8)).toMatchObject({ freeAgent: false, ...teamFields({}, false) });
  });

  it("leaves out the youth pool without a team link and freezes the summaries", () => {
    expect(players.map((player) => player.id)).toEqual([158_023, 7, 8]);
    expect(Object.isFrozen(players)).toBe(true);
    expect(players.every((player) => Object.isFrozen(player))).toBe(true);
    expect(Object.isFrozen(players[0]?.attributes)).toBe(true);
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
      // The game counts the years from the year the save's season started (2009).
      contractYearsLeft: 3,
    });
    // The save links clubs only; the national team comes from fifa.db.
    expect(byId(players, 158_023)).toMatchObject({ nationalTeamName: "Argentina", clubId: 241 });
  });

  it("marks the players the save links to the game's free-agent team", () => {
    expect(byId(players, 8)).toMatchObject({ freeAgent: true, clubId: null, clubName: null });
    expect(byId(players, 7)?.freeAgent).toBe(false);
  });

  it("includes youth-pool players the save places in a team, the academy, the transfer list or the shortlist", () => {
    expect(players.map((player) => [player.id, player.youth, player.academy])).toEqual([
      [158_023, false, false],
      [7, false, false],
      [8, false, false],
      [400_001, true, true],
      [400_002, true, false],
      [400_003, true, false],
      [400_004, true, false],
    ]);
    expect(byId(players, 400_002)).toMatchObject({ positionName: "ST", positionGroup: "forwards" });
  });

  it("rates players in career mode, capped at the career potential", () => {
    expect(byId(players, 158_023)?.overall).toBe(60);
    expect(byId(players, 7)?.overall).toBe(45);
    expect(byId(players, 7)?.overallByCode[0]).toBe(45);
  });

  // The user's players gain attributes from matches, training and the season change; the save keeps them.
  it("adds the attribute gains the save records", () => {
    const grown: CareerSave = new Map([
      ...SAVE,
      ["career_players_grown_attributes", [row(grownRow(158_023, { finishing_delta: 10 }))]],
    ]);
    const before = byId(players, 158_023);
    const after = byId(buildPlayers(DB, grown), 158_023);
    expect(after?.attributes.finishing).toBe((before?.attributes.finishing ?? 0) + 10);
    expect(after?.overallByCode[29]).toBeGreaterThan(before?.overallByCode[29] ?? 0);
    expect(after?.attributes.dribbling).toBe(before?.attributes.dribbling);
  });

  it("shows the career potential: the database's plus the save's potential delta", () => {
    expect(byId(players, 7)).toMatchObject({ potential: 45, growth: 0 });
  });

  it("projects the peak OVR with a save only", () => {
    // Flat curves: the projection stays at today's OVR, at every position.
    expect(byId(players, 158_023)).toMatchObject({ peak: 60, overall: 60, peakGain: 0 });
    expect(byId(players, 158_023)?.peakByCode).toEqual(byId(players, 158_023)?.overallByCode);
    expect(byId(buildPlayers(DB), 158_023)).toMatchObject({ peak: null, ...NO_BEST_PEAK });
  });

  // The save keeps the rolling match rating (KR) times ten: 69 is the 6,9 of the game's stats screen.
  it("adds career stats where the save has them", () => {
    expect(byId(players, 158_023)).toMatchObject({
      form: 6.9,
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

  it("marks the players on the game's shortlist, none without a save", () => {
    expect(players.filter((player) => player.shortlisted).map((player) => player.id)).toEqual([
      158_023, 400_004,
    ]);
    expect(buildPlayers(DB).some((player) => player.shortlisted)).toBe(false);
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

/** Sorts with a timing line; the result must hold every input player once. */
const timedSort = (label: string, ...args: Parameters<typeof sortPlayers>): void => {
  const sorted = timed(label, () => sortPlayers(...args));
  const ids = new Set(sorted.map((player) => player.id));
  expect([sorted.length, ids.size]).toEqual([args[0].length, args[0].length]);
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
    timedSort("sortPlayers all by name", players, "name", "ascending");
    timedSort("sortPlayers all by age", players, "age", "descending");
    timedSort(
      "filter + sort by position rating",
      filterPlayers(players, { positionRating: { code: 3, min: 50 }, clubStatus: "available" }),
      "positionRating",
      "descending",
      { ratingCode: 3 },
    );
    timedSort(
      "filter + sort",
      filterPlayers(players, { ranges: { potential: { min: 60 } }, flags: { selfish: false } }),
      "clubName",
      "ascending",
    );
    expect(filtered.length).toBeGreaterThan(0);
  });

  it.runIf(existsSync(realCareerPath))("builds the career's players", () => {
    const db = realDb();
    const players = buildPlayers(db, parseCareerSave(db, readFileSync(realCareerPath)));
    expect(players.filter((player) => player.clubName === "Wisła Kraków")).toHaveLength(23);
    expect(players.filter((player) => player.youth)).toHaveLength(3);
    timedSort("sortPlayers career by price", players, "price", "descending");
  });
});
