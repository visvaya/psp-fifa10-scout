import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { buildPlainSave, buildScoutDb } from "./test-support/scout-db.ts";

// The save keeps league games apart from the domestic cup and the European cups (cup0..cup3).
describe("cup stats", () => {
  const db = parseEaDb(buildScoutDb());
  // Built inside each test, not when the file loads, so mutation testing sees the code run per test.
  const byId = (id: number) =>
    buildPlayers(db, parseCareerSave(db, buildPlainSave().dataBin)).find(
      (player) => player.id === id,
    );

  it("sums the cup columns apart from the league", () => {
    expect(byId(158_023)).toMatchObject({
      appearances: 5,
      goals: 3,
      cupAppearances: 3,
      cupGoals: 1,
      assists: 2,
      cupAssists: 1,
    });
    expect(byId(1000)).toMatchObject({ cleanSheets: 2, cupCleanSheets: 1 });
  });

  // Owner, 2026-11-11: one count over the league and the cups together.
  it("adds the league and the cups into the totals", () => {
    expect(byId(158_023)).toMatchObject({ totalAppearances: 8, totalGoals: 4, totalAssists: 3 });
    expect(byId(1000)).toMatchObject({ totalCleanSheets: 3 });
  });

  it("has no cup stats without a row in the save", () => {
    expect(byId(7)).toMatchObject({
      cupAppearances: null,
      cupGoals: null,
      assists: null,
      cupAssists: null,
      cleanSheets: null,
      cupCleanSheets: null,
      totalAppearances: null,
      totalCleanSheets: null,
    });
  });

  it("leaves a column the stats row lacks empty", () => {
    const save = parseCareerSave(db, buildPlainSave().dataBin);
    const short = new Map([...save, ["playerstats", [{ playerid: 158_023, form: 69 }]]]);
    expect(buildPlayers(db, short).find((player) => player.id === 158_023)).toMatchObject({
      form: 6.9,
      assists: null,
      cleanSheets: null,
    });
  });
});
