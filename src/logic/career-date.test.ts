// Which day career ratings are aged to: the season's first match day, not the last played game.
import { describe, expect, it } from "vitest";
import type { CareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import { CURVE_COLUMNS } from "./overall-rating.ts";
import { buildPlayers } from "./players.ts";
import { playerRow, table } from "./test-support/player-fixtures.ts";

const daysSince1582 = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1582, 9, 14)) / 86_400_000;
/** A fixtures or team_manager game number: the day, then a 10-bit game index. */
const gameOn = (year: number, month: number, day: number): number =>
  daysSince1582(year, month, day) * 1024;

/** Curve values for ages 15..45, flat at 50 except at age 21. */
const curve = (id: number, at21: number): Readonly<Record<string, number>> => ({
  id,
  ...Object.fromEntries(CURVE_COLUMNS.map((column, index) => [column, index === 6 ? at21 : 50])),
});

const DB = parseEaDb(
  buildEaDb([
    table("leagues", [{ leagueid: 1, leaguename: "League", level: 1 }]),
    table("teams", [{ teamid: 1, teamname: "Club", overallrating: 60 }]),
    table("leagueteamlinks", [{ leagueid: 1, teamid: 1 }]),
    table("teamplayerlinks", [
      { teamid: 1, playerid: 5, jerseynumber: 1, yearcontractvalidtil: 2012 },
    ]),
    table("country", [{ countryid: 1, countryname: "Country" }]),
    // Turns 21 on 2009-08-01: 20 on the first match day, 21 on the last game below.
    table("players", [
      playerRow({ playerid: 5, birthdate: daysSince1582(1988, 8, 1), potential: 99 }),
    ]),
    // Type 1, style 2: skills follow curve 3 * 2 + 1 - 4 = 3, which rises at 21.
    table("curves", [curve(1, 50), curve(3, 60)]),
  ]),
);

const row = (values: Readonly<Record<string, number | string>>): EaDbRow => Object.freeze(values);

const save = (fixtures: readonly EaDbRow[]): CareerSave =>
  new Map([
    [
      "team_manager",
      [row({ team_id: 1, firstname: "A", surname: "B", last_game_number: gameOn(2009, 10, 7) })],
    ],
    [
      "teamplayerlinks",
      [row({ teamid: 1, playerid: 5, jerseynumber: 9, yearcontractvalidtil: 2012 })],
    ],
    ["fixtures", fixtures],
    ["playerstats", []],
    ["career_transfer_list", []],
    ["career_youth_accademy", []],
    ["career_players_grown_attributes", []],
    ["career_extra_user_team_info", []],
  ]);

describe("career ratings", () => {
  it("age players to the season's first match day, while the age shown is today's", () => {
    const [player] = buildPlayers(DB, save([row({ game_number: gameOn(2009, 7, 25) })]));
    expect(player).toMatchObject({ overall: 50, age: 21 });
    expect(player?.attributes.finishing).toBe(50);
  });

  it("age players to the last game when the save has no fixtures", () => {
    const [player] = buildPlayers(DB, save([]));
    expect(player?.overall).toBeGreaterThan(50);
    // The attributes shown and filtered are the aged ones too: skills rise to 60 at 21.
    expect(player?.attributes.finishing).toBe(60);
  });
});
