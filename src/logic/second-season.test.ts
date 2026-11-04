// The owner's second-season save (Wisła Kraków, 2011-04-06), checked against the game's screens. Game
// data never enters the repository: FIFA_DB_PATH and PSP_SECOND_SEASON_SAVE (plain DATA.BIN) point at
// local copies.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";

const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const secondSeasonPath = process.env["PSP_SECOND_SEASON_SAVE"] ?? "";
const realDb = () => parseEaDb(readFileSync(realDbPath));

describe.runIf(existsSync(realDbPath) && existsSync(secondSeasonPath))(
  "real second-season save",
  () => {
    it("matches the game's screens in the second season", () => {
      const db = realDb();
      const save = parseCareerSave(db, readFileSync(secondSeasonPath));
      const players = new Map(buildPlayers(db, save).map((player) => [player.id, player]));
      // "Kontrakty zawodników": Paweł Brożek, finishing +2 from his matches, contract to 2013 as 3 years.
      expect(players.get(105_827)?.price).toBe(6_100_000);
      // The game's stored OVR of every squad player this season.
      const history = save.get("career_overall_history") ?? [];
      const differ = history.filter(
        (entry) => players.get(Number(entry["playerid"]))?.overall !== Number(entry["season1"]),
      );
      expect(history.length).toBeGreaterThan(20);
      expect(differ).toEqual([]);
      // "Wykres rozwoju" of the academy's Boris Trzcinski: 52 now, then 55 and 57.
      const junior = players.get(406_667);
      expect(junior?.overall).toBe(52);
      expect(junior?.peak).toBeGreaterThanOrEqual(57);
    });
  },
);
