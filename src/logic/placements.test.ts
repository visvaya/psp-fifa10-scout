import { describe, expect, it } from "vitest";
import type { CareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import { teamsById } from "./placements.ts";
import { table } from "./test-support/player-fixtures.ts";

const DB = parseEaDb(
  buildEaDb([
    // Data rows, alike by nature. jscpd:ignore-start
    table("leagues", [
      { leagueid: 1, leaguename: "First", level: 1, leagueprestige: 10 },
      { leagueid: 2, leaguename: "Second", level: 2, leagueprestige: 5 },
      { leagueid: 78, leaguename: "International", level: 5, leagueprestige: 0 },
    ]),
    table("teams", [
      { teamid: 10, teamname: "Up", overallrating: 60, internationalprestige: 3 },
      { teamid: 20, teamname: "Down", overallrating: 70, internationalprestige: 4 },
      { teamid: 30, teamname: "Country", overallrating: 80, internationalprestige: 9 },
    ]),
    table("leagueteamlinks", [
      { leagueid: 2, teamid: 10 },
      { leagueid: 1, teamid: 20 },
      { leagueid: 78, teamid: 30 },
    ]),
    // jscpd:ignore-end
  ]),
);

/** A team's league name and its league plus team prestige. */
const league = (teams: ReturnType<typeof teamsById>, id: number) => {
  const team = teams.get(id);
  return team && [team.leagueName, team.prestige];
};

describe("teamsById", () => {
  // Promotion and relegation: a career save keeps the club leagues, not the national teams' links.
  it("takes the club leagues from the save and the rest from fifa.db", () => {
    const save: CareerSave = new Map([
      [
        "leagueteamlinks",
        [
          { leagueid: 1, teamid: 10 },
          { leagueid: 2, teamid: 20 },
        ],
      ],
    ]);
    const career = teamsById(DB, save);
    expect(league(career, 10)).toEqual(["First", 13]);
    expect(league(career, 20)).toEqual(["Second", 9]);
    expect(league(career, 30)).toEqual(["International", 9]);
    expect(league(teamsById(DB), 10)).toEqual(["Second", 8]);
  });
});
