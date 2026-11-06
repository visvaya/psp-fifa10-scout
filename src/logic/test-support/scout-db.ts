// A small synthetic fifa.db with every table the app reads, and a plain career save for it. Shared
// by the load tests and scripts/write-synthetic-db.ts, which feeds the browser tests.
import { buildCareerSave } from "../../data/test-support/synthetic-career-save.ts";
import { buildEaDb } from "../../data/test-support/synthetic-ea-db.ts";
import type { TableSpec } from "../../data/test-support/synthetic-ea-db.ts";
import { countryKey, labelKey, leagueKey, teamKey } from "../../data/game-locale.ts";
import { buildLocale } from "../../data/test-support/synthetic-locale.ts";
import { buildFileList, buildParamSfo } from "../../data/test-support/synthetic-save.ts";
import {
  attributes,
  daysSince1582,
  flatCurves,
  floatBits,
  playerRow,
  table,
} from "./player-fixtures.ts";

/** The birthdate of a player born on 15 January of `year`. */
const born = (year: number): number => daysSince1582(year, 1, 15);

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
    // A star's ratings, so his price runs to millions and the price columns are tested against it.
    ...attributes(85, { sprintspeed: 92, dribbling: 96 }),
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

/**
 * Messi's season so far: the save keeps his average match rating 6,9 times ten; a domestic cup game
 * and two Champions League games with a goal and an assist (cup0, cup1). Gracz Numer 1 keeps goal: the
 * game counts clean sheets for goalkeepers only.
 */
const STATS = table("playerstats", [
  {
    playerid: 158_023,
    form: 69,
    morale: 4,
    goals: 3,
    appearances: 5,
    injurydaysout: 0,
    appearancescup0: 1,
    appearancescup1: 2,
    goalscup1: 1,
    assists: 2,
    assistscup1: 1,
  },
  { playerid: 1000, form: 60, appearances: 4, cleansheets: 2, cleansheetscup1: 1 },
]);

export const SCOUT_USER_TEAM_ID = 1873;

/** The synthetic database, with `extra` tables a test adds. */
export const buildScoutDb = (extra: readonly TableSpec[] = []): Uint8Array =>
  buildEaDb([
    ...extra,
    table("leagues", [
      { leagueid: 53, leaguename: "Spain Primera Division (1)", level: 1, leagueprestige: 19 },
      { leagueid: 76, leaguename: "Rest of World", level: 4, leagueprestige: 5 },
    ]),
    table("teams", [
      { teamid: 241, teamname: "FC Barcelona", overallrating: 84, internationalprestige: 19 },
      { teamid: 1873, teamname: "Wisła Kraków", overallrating: 66, internationalprestige: 6 },
      { teamid: 10, teamname: "Łódzki KS", overallrating: 58, internationalprestige: 4 },
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
      {
        teamid: 241,
        playerid: 158_023,
        jerseynumber: 10,
        yearcontractvalidtil: 2014,
        position: 33,
      },
      { teamid: 1873, playerid: 7, jerseynumber: 9, yearcontractvalidtil: 2010, position: 33 },
      ...generated.map((_, index) => ({
        teamid: CLUBS[index % CLUBS.length] ?? 10,
        playerid: 1000 + index,
        jerseynumber: index + 1,
        yearcontractvalidtil: 2009 + (index % 5),
        position: 33,
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
    STATS,
    empty("career_youth_accademy"),
    // Gracz Numer 18 is listed for a loan.
    table("career_transfer_list", [{ playerid: 1017, is_loan: 1, sold: 0 }]),
    // Messi is on the user's shortlist in the game.
    table("career_shortlist", [{ playerid: 158_023, shortlist_dummy: 0 }]),
    empty("career_players_grown_attributes"),
    // Brożek plays for the user's club: the card shows his contract's wage, not the market's.
    table("career_extra_user_team_info", [
      { playerid: 7, wage: floatBits(5700), bonus: 0, bonus_type: 0, contract_status: 0 },
    ]),
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
