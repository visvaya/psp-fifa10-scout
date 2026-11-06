import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../src/data/career-save.ts";
import { parseEaDb } from "../src/data/ea-db.ts";
import { buildPlayers } from "../src/logic/players.ts";
import { buildPlainSave } from "../src/logic/test-support/scout-db.ts";
import { buildSampleDb, CLUBS } from "./sample-database.ts";

const KEEPER_CODE = 0;
const db = parseEaDb(buildSampleDb());
const players = buildPlayers(db);
const career = buildPlayers(db, parseCareerSave(db, buildPlainSave().dataBin));
const YOUNG_AGE = 23;
const OLD_AGE = 31;

describe("the sample database of the screenshots", () => {
  it("is the same bytes on every run", () => {
    expect(buildSampleDb()).toEqual(buildSampleDb());
  });

  it("lists invented players of every role, each with a club", () => {
    expect(players).toHaveLength(48);
    expect(new Set(players.map((player) => player.name)).size).toBe(players.length);
    expect(new Set(players.map((player) => player.positionGroup)).size).toBeGreaterThanOrEqual(4);
    expect(players.every((player) => player.clubName !== null)).toBe(true);
    // Only the invented clubs, every one of them with players.
    expect(new Set(players.map((player) => player.clubName))).toEqual(
      new Set(CLUBS.map((club) => club.teamname)),
    );
  });

  it("rates players differently by position: an outfield player is a poor keeper", () => {
    for (const player of players.filter((candidate) => candidate.positionCode !== KEEPER_CODE)) {
      expect(player.overallByCode[KEEPER_CODE]).toBeLessThan(player.overall - 10);
    }
    const keeper = players.find((player) => player.positionCode === KEEPER_CODE);
    expect(keeper?.overall).toBeGreaterThan(40);
    expect(new Set(players.map((player) => player.overall)).size).toBeGreaterThan(10);
  });

  it("grows the young and ages the old along the development curves of a career", () => {
    const young = career.filter((player) => player.age <= YOUNG_AGE);
    expect(young.length).toBeGreaterThan(5);
    expect(young.filter((player) => (player.peakGain ?? 0) > 0).length).toBeGreaterThan(
      young.length / 2,
    );
    const old = career.filter((player) => player.age >= OLD_AGE);
    expect(old.length).toBeGreaterThan(5);
    expect(old.every((player) => player.peakGain === 0)).toBe(true);
    // Ageing moves the career OVR away from the database's for some players.
    expect(career.some((player, index) => player.overall !== players[index]?.overall)).toBe(true);
  });

  it("has players whose best peak is at another position than their best today", () => {
    const moved = career.filter(
      (player) =>
        player.bestPeakCode !== null &&
        (player.overallByCode[player.bestPeakCode] ?? 0) < Math.max(...player.overallByCode),
    );
    expect(moved.length).toBeGreaterThanOrEqual(2);
  });
});
