import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { buildPlainSave, buildScoutDb } from "./test-support/scout-db.ts";

// The save keeps league games apart from the domestic cup and the European cups (cup0..cup3).
describe("cup stats", () => {
  const db = parseEaDb(buildScoutDb());
  const players = buildPlayers(db, parseCareerSave(db, buildPlainSave().dataBin));
  const byId = (id: number) => players.find((player) => player.id === id);

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

  it("has no cup stats without a row in the save", () => {
    expect(byId(7)).toMatchObject({
      cupAppearances: null,
      cupGoals: null,
      assists: null,
      cleanSheets: null,
    });
  });
});
