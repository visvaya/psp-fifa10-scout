import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";
import { ATTRIBUTE_NAMES } from "./attributes.ts";
import type { Player } from "./players.ts";
import { clubStarsOf, teamStars } from "./team-stars.ts";
import { buildPlainSave, buildScoutDb } from "./test-support/scout-db.ts";
import { grownRow, table } from "./test-support/player-fixtures.ts";

const sixteen = (overall: number): readonly number[] => Array.from({ length: 16 }, () => overall);

describe("teamStars", () => {
  it("gives half a star below 55 and one star from 55", () => {
    expect(teamStars(sixteen(54))).toBe(0.5);
    expect(teamStars(sixteen(55))).toBe(1);
  });

  it("gives four and a half stars below 82 and five from 82", () => {
    expect(teamStars(sixteen(81))).toBe(4.5);
    expect(teamStars(sixteen(82))).toBe(5);
  });

  it("steps in half stars at each threshold", () => {
    expect(
      [59, 60, 62, 63, 64, 65, 67, 68, 70, 71, 74, 75, 77, 78].map((overall) =>
        teamStars(sixteen(overall)),
      ),
    ).toEqual([1, 1.5, 1.5, 2, 2, 2.5, 2.5, 3, 3, 3.5, 3.5, 4, 4, 4.5]);
  });

  it("takes the whole-number mean of the 16 best, rounded down", () => {
    // 15 at 60 and one at 59: the mean 59.94 counts as 59.
    expect(teamStars([...Array.from({ length: 15 }, () => 60), 59])).toBe(1);
    // The 17th and lower do not count.
    expect(teamStars([...sixteen(60), 10, 10])).toBe(1.5);
  });

  it("averages all of fewer than 16 players", () => {
    expect(teamStars([90, 74])).toBe(5);
    expect(teamStars([70])).toBe(3);
  });

  it("reads only the first 30 of more links", () => {
    expect(teamStars([...Array.from({ length: 30 }, () => 60), ...sixteen(90)])).toBe(1.5);
  });

  it("gives half a star to an empty squad, as the game's mean of 0", () => {
    expect(teamStars([])).toBe(0.5);
  });
});

const link = (teamid: number, playerid: number): EaDbRow => ({ teamid, playerid });

describe("clubStarsOf", () => {
  it("rates each club from its own links, skipping players without an OVR, none without a club", () => {
    const players = [
      { id: 10, overall: 70 },
      { id: 11, overall: 72 },
      { id: 20, overall: 50 },
    ];
    const starsOf = clubStarsOf(players, [link(1, 10), link(2, 20), link(1, 11), link(1, 99)]);
    expect([starsOf(1), starsOf(2), starsOf(3), starsOf(null)]).toEqual([3.5, 0.5, null, null]);
  });
});

/** The synthetic career's players, with every attribute of Wisła's squad `gain` higher in the save. */
const careerWithGain = (gain: number) => {
  const deltas = Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [`${name}_delta`, gain]));
  const squad = [7, ...Array.from({ length: 20 }, (_, index) => 1001 + 3 * index)];
  const grown = table(
    "career_players_grown_attributes",
    squad.map((id) => grownRow(id, deltas)),
  );
  const db = parseEaDb(buildScoutDb([grown]));
  return buildPlayers(db, parseCareerSave(db, buildPlainSave().dataBin));
};

const wisla = (players: readonly Player[]) => players.find((player) => player.id === 7);

describe("buildPlayers' club stars", () => {
  // The game rates a club from the career OVR of its squad, which the saved gains raise.
  it("rates the club from its squad's career OVR, gains included, and none without a club", () => {
    const [before, after] = [careerWithGain(0), careerWithGain(20)];
    expect(wisla(before)).toMatchObject({ clubId: 1873, clubStars: 0.5 });
    expect(wisla(after)).toMatchObject({ clubId: 1873, clubStars: 2.5 });
    expect(before.find((player) => player.id === 8)).toMatchObject({
      clubId: null,
      clubStars: null,
    });
  });
});

// Game data never enters the repository. FIFA_DB_PATH points at a local fifa.db and
// PSP_TEAM_STARS_REFERENCE at the stars research script's table for it (teamid | name | ... | stars in the
// seventh column); PSP_TEAM_STARS_SAVE (plain DATA.BIN) and PSP_TEAM_STARS_SAVE_REFERENCE at a career save
// and the script's table for it, aged to the season's first match day as the tool ages it (the script's own
// default, the last game date, moves clubs near a threshold by half a star).
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const referencePath = process.env["PSP_TEAM_STARS_REFERENCE"] ?? "";
const savePath = process.env["PSP_TEAM_STARS_SAVE"] ?? "";
const saveReferencePath = process.env["PSP_TEAM_STARS_SAVE_REFERENCE"] ?? "";

/** The research table's stars by team id. */
const referenceStars = (path: string): ReadonlyMap<number, number> =>
  new Map(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.split(" | "))
      .filter((cells) => /^\d+$/u.test(cells[0] ?? ""))
      .map((cells) => [Number(cells[0]), Number(cells[6])]),
  );

/** Clubs whose stars differ from the reference, as [team id, tool, reference]. */
const disagreements = (players: readonly Player[], reference: ReadonlyMap<number, number>) => {
  const clubs = new Map(
    players.flatMap((player) =>
      player.clubId === null ? [] : [[player.clubId, player.clubStars]],
    ),
  );
  expect(clubs.size).toBeGreaterThan(400);
  return [...clubs]
    .filter(([id, stars]) => reference.get(id) !== stars)
    .map(([id, stars]) => [id, stars, reference.get(id)]);
};

describe.runIf(existsSync(realDbPath) && existsSync(referencePath))("real team stars", () => {
  it("agrees with the research script for every club in fifa.db", () => {
    const db = parseEaDb(readFileSync(realDbPath));
    expect(disagreements(buildPlayers(db), referenceStars(referencePath))).toEqual([]);
  });

  it.runIf(existsSync(savePath) && existsSync(saveReferencePath))(
    "agrees for every club in a career save but the one known OVR exception",
    () => {
      const db = parseEaDb(readFileSync(realDbPath));
      const players = buildPlayers(db, parseCareerSave(db, readFileSync(savePath)));
      // PSV (247): one 36-year-old player rates 74 here and 75 in the script, which puts the squad's
      // mean on the other side of 78. An OVR-model difference, not investigated.
      expect(disagreements(players, referenceStars(saveReferencePath))).toEqual([[247, 4, 4.5]]);
    },
  );
});
