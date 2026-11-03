// A small synthetic fifa.db with every table the app reads, and a plain career save for it. Shared
// by the load tests and scripts/write-synthetic-db.ts, which feeds the browser tests.
import { buildCareerSave } from "../../data/test-support/synthetic-career-save.ts";
import { buildEaDb } from "../../data/test-support/synthetic-ea-db.ts";
import type { TableSpec } from "../../data/test-support/synthetic-ea-db.ts";
import { countryKey, labelKey, leagueKey, teamKey } from "../../data/game-locale.ts";
import { buildLocale } from "../../data/test-support/synthetic-locale.ts";
import { buildFileList, buildParamSfo } from "../../data/test-support/synthetic-save.ts";
import { flatCurves, playerRow, table } from "./player-fixtures.ts";

/** Days since 1582-10-14, the fifa.db birthdate epoch. */
const born = (year: number): number => (Date.UTC(year, 0, 15) - Date.UTC(1582, 9, 14)) / 86_400_000;

const empty = (name: string): TableSpec => ({ name, u32: ["playerid"], rows: [] });

const CLUBS = [241, 1873, 10];
/** Positions cycling through every group: GK, CB, LB, CDM, RM, CM, CAM, ST. */
const POSITIONS = [0, 5, 7, 11, 15, 17, 23, 29];

/** Generated squad players 1000..1059 with varied age, position, potential and club; one long name
 * near the end of the list, so the table's column widths are tested against it. */
const generated = Array.from({ length: 60 }, (_, index) =>
  playerRow({
    playerid: 1000 + index,
    firstname: "Gracz",
    surname: index === 8 ? "Numer 9 Bardzo-Długie-Nazwisko-Testowe" : `Numer ${String(index + 1)}`,
    birthdate: born(1975 + (index % 20)),
    nationality: index % 2 === 0 ? 37 : 52,
    preferredposition1: POSITIONS[index % POSITIONS.length] ?? 0,
    potential: 50 + ((index * 7) % 45),
    sprintspeed: 40 + ((index * 11) % 55),
  }),
);

const PLAYERS = table("players", [
  playerRow({
    playerid: 158_023,
    firstname: "Lionel",
    surname: "Messi",
    birthdate: born(1987),
    nationality: 52,
    preferredposition1: 14,
    potential: 95,
    sprintspeed: 92,
    dribbling: 96,
    technicaldribbler: 1,
  }),
  playerRow({
    playerid: 7,
    firstname: "Paweł",
    surname: "Brożek",
    birthdate: born(1983),
    nationality: 37,
    preferredposition1: 29,
    potential: 74,
    // Rates 58 as a full-back and 57 as a sweeper: the card shows that row as approximate.
    tackling: 92,
    marking: 46,
    heading: 48,
    ballcontrol: 43,
    shortpassing: 38,
    strength: 73,
    stamina: 54,
  }),
  playerRow({
    playerid: 8,
    firstname: "Jan",
    surname: "Wolny",
    birthdate: born(1990),
    nationality: 37,
  }),
  ...generated,
]);

export const SCOUT_USER_TEAM_ID = 1873;

export const buildScoutDb = (): Uint8Array =>
  buildEaDb([
    table("leagues", [
      { leagueid: 53, leaguename: "Spain Primera Division (1)", level: 1 },
      { leagueid: 76, leaguename: "Rest of World", level: 4 },
    ]),
    table("teams", [
      { teamid: 241, teamname: "FC Barcelona", overallrating: 84 },
      { teamid: 1873, teamname: "Wisła Kraków", overallrating: 66 },
      { teamid: 10, teamname: "Łódzki KS", overallrating: 58 },
    ]),
    table("leagueteamlinks", [
      { leagueid: 53, teamid: 241 },
      { leagueid: 76, teamid: 1873 },
      { leagueid: 76, teamid: 10 },
    ]),
    table("country", [
      { countryid: 52, countryname: "Argentina" },
      { countryid: 37, countryname: "Poland" },
    ]),
    PLAYERS,
    table("teamplayerlinks", [
      { teamid: 241, playerid: 158_023, jerseynumber: 10, yearcontractvalidtil: 2014 },
      { teamid: 1873, playerid: 7, jerseynumber: 9, yearcontractvalidtil: 2010 },
      ...generated.map((_, index) => ({
        teamid: CLUBS[index % CLUBS.length] ?? 10,
        playerid: 1000 + index,
        jerseynumber: index + 1,
        yearcontractvalidtil: 2010 + (index % 5),
      })),
    ]),
    table("team_manager", [
      {
        team_id: SCOUT_USER_TEAM_ID,
        firstname: "Anna",
        surname: "Kariera",
        // 2009-08-08, game 7 of that day: days since 1582-10-14 times 1024, plus the game.
        last_game_number: 155_892 * 1024 + 7,
      },
    ]),
    empty("playerstats"),
    empty("career_youth_accademy"),
    empty("career_transfer_list"),
    empty("career_players_grown_attributes"),
    flatCurves(),
  ]);

/** Polish game names for part of the synthetic database: a pol_pl.loc and its string.idx. */
export const buildScoutLocale = (): { readonly loc: Uint8Array; readonly idx: Uint8Array } =>
  buildLocale([
    [countryKey(37), "Polska"],
    [countryKey(52), "Argentyna"],
    [leagueKey(53, 0), "Liga BBVA"],
    [leagueKey(53, 3), "Hiszpania"],
    [leagueKey(76, 0), "Reszta Świata"],
    [teamKey(10, 0), "ŁKS Łódź"],
    [labelKey("GK"), "BR"],
  ]);

/** An unencrypted save with no table chunks: the career as fifa.db stores it. */
export const buildPlainSave = (): { dataBin: Uint8Array; paramSfo: Uint8Array } => {
  const params = new Uint8Array(128);
  return {
    dataBin: buildCareerSave([]),
    paramSfo: buildParamSfo([
      { key: "SAVEDATA_FILE_LIST", value: buildFileList("DATA.BIN", new Uint8Array(16)) },
      { key: "SAVEDATA_PARAMS", value: params },
    ]),
  };
};
