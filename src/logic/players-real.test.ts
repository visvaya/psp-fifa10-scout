import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { filterPlayers } from "./filter-players.ts";
import { buildPlayers } from "./players.ts";
import { sortPlayers } from "./sort-players.ts";

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
