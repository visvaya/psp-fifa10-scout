import { describe, expect, it } from "vitest";
import { parseEaDb } from "../src/data/ea-db.ts";
import { buildPlayers } from "../src/logic/players.ts";
import { buildSampleDb } from "./sample-database.ts";

const KEEPER_CODE = 0;
const players = buildPlayers(parseEaDb(buildSampleDb()));

describe("the sample database of the screenshots", () => {
  it("is the same bytes on every run", () => {
    expect(buildSampleDb()).toEqual(buildSampleDb());
  });

  it("lists invented players of every role, each with a club", () => {
    expect(players).toHaveLength(48);
    expect(new Set(players.map((player) => player.name)).size).toBe(players.length);
    expect(new Set(players.map((player) => player.positionGroup)).size).toBeGreaterThanOrEqual(4);
    expect(players.every((player) => player.clubName !== null)).toBe(true);
    // The invented clubs and countries only: nothing from the real game.
    expect(new Set(players.map((player) => player.clubName)).size).toBe(8);
  });

  it("rates players differently by position: an outfield player is a poor keeper", () => {
    for (const player of players.filter((candidate) => candidate.positionCode !== KEEPER_CODE)) {
      expect(player.overallByCode[KEEPER_CODE]).toBeLessThan(player.overall - 10);
    }
    const keeper = players.find((player) => player.positionCode === KEEPER_CODE);
    expect(keeper?.overall).toBeGreaterThan(40);
    expect(new Set(players.map((player) => player.overall)).size).toBeGreaterThan(10);
  });
});
