// A second-season save checked against the game's screens. Game data never enters the repository:
// FIFA_DB_PATH and PSP_SECOND_SEASON_SAVE (plain DATA.BIN) point at local copies, and
// PSP_SECOND_SEASON_REFERENCE at a local JSON of values read off the game's screens for that save:
// prices as [player id, price] and development charts as [player id, OVR now, highest OVR shown].
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import { buildPlayers } from "./players.ts";

const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const savePath = process.env["PSP_SECOND_SEASON_SAVE"] ?? "";
const referencePath = process.env["PSP_SECOND_SEASON_REFERENCE"] ?? "";

const isNumbers = (item: unknown): item is readonly number[] =>
  Array.isArray(item) && item.every((value) => Number.isFinite(value));

const rows = (body: unknown, key: string): readonly (readonly number[])[] => {
  const value: unknown =
    typeof body === "object" && body !== null
      ? Object.entries(body).find(([name]) => name === key)?.[1]
      : undefined;
  return Array.isArray(value) ? value.filter(isNumbers) : [];
};

const load = () => {
  const db = parseEaDb(readFileSync(realDbPath));
  const save = parseCareerSave(db, readFileSync(savePath));
  return { save, players: new Map(buildPlayers(db, save).map((player) => [player.id, player])) };
};

describe.runIf(existsSync(realDbPath) && existsSync(savePath))("real second-season save", () => {
  it("gives every squad player the OVR the game stores for this season", () => {
    const { save, players } = load();
    const history = save.get("career_overall_history") ?? [];
    const differ = history.filter(
      (entry) => players.get(Number(entry["playerid"]))?.overall !== Number(entry["season1"]),
    );
    expect(history.length).toBeGreaterThan(0);
    expect(differ).toEqual([]);
  });

  it.runIf(existsSync(referencePath))("matches the prices and charts on the game's screens", () => {
    const { players } = load();
    const reference: unknown = JSON.parse(readFileSync(referencePath, "utf8"));
    const prices = rows(reference, "prices");
    const charts = rows(reference, "projections");
    expect(prices.length + charts.length).toBeGreaterThan(0);
    for (const [id = 0, price] of prices) expect(players.get(id)?.price).toBe(price);
    for (const [id = 0, now, highest = 0] of charts) {
      expect(players.get(id)?.overall).toBe(now);
      expect(players.get(id)?.peak).toBeGreaterThanOrEqual(highest);
    }
  });
});
