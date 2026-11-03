import { describe, expect, it } from "vitest";
import { SaveFormatError } from "../data/save-format-error.ts";
import { classifyLoadError, loadScout, pickSaveFiles } from "./load-scout.ts";
import type { LoadPhase } from "./load-scout.ts";
import { buildPlainSave, buildScoutDb, SCOUT_USER_TEAM_ID } from "./test-support/scout-db.ts";

const blob = (bytes: Uint8Array): Blob => new Blob([bytes.slice()]);

describe("loadScout", () => {
  it("reads a bare fifa.db, reports the phases and returns the players and the database", async () => {
    const phases: LoadPhase[] = [];
    const db = buildScoutDb();
    const result = await loadScout({ game: blob(db) }, (phase) => phases.push(phase));
    expect(phases).toEqual(["game", "players"]);
    expect(result.players).toHaveLength(63);
    expect(result.myTeamId).toBeNull();
    expect(result.gameDb).toEqual(db);
  });

  it("applies a career save and names the user's team", async () => {
    const phases: LoadPhase[] = [];
    const { dataBin, paramSfo } = buildPlainSave();
    const result = await loadScout(
      { game: blob(buildScoutDb()), save: { dataBin: blob(dataBin), paramSfo: blob(paramSfo) } },
      (phase) => phases.push(phase),
    );
    expect(phases).toEqual(["game", "save", "players"]);
    expect(result.myTeamId).toBe(SCOUT_USER_TEAM_ID);
  });

  it("tags a failure with the file that caused it", async () => {
    await expect(loadScout({ game: blob(new Uint8Array(8)) }, () => undefined)).rejects.toEqual(
      expect.objectContaining({ error: { stage: "game", kind: "wrong-file" } }),
    );
    const bad = { dataBin: blob(new Uint8Array(4)), paramSfo: blob(new Uint8Array(4)) };
    await expect(
      loadScout({ game: blob(buildScoutDb()), save: bad }, () => undefined),
    ).rejects.toEqual(expect.objectContaining({ error: { stage: "save", kind: "wrong-file" } }));
  });
});

describe("classifyLoadError", () => {
  it.each([
    ["Disc image is not FIFA 10 ULES01328: found X", "wrong-game"],
    ["Save hash does not match PARAM.SFO: wrong game or damaged file", "wrong-game"],
    ["Not an ISO 9660 disc image", "wrong-file"],
    ["Not a FIFA 10 disc image or database file", "wrong-file"],
    ["PARAM.SFO is too short", "wrong-file"],
    ["PARAM.SFO does not describe a save", "wrong-file"],
    ["Save holds players twice", "damaged"],
  ])("%s is %s", (message, kind) => {
    expect(classifyLoadError("save", new SaveFormatError(message))).toEqual({
      stage: "save",
      kind,
    });
  });

  it("calls anything else unexpected", () => {
    expect(classifyLoadError("game", new TypeError("x"))).toEqual({
      stage: "game",
      kind: "unexpected",
    });
  });
});

const file = (name: string) => ({ name });

describe("pickSaveFiles", () => {
  it("finds DATA.BIN and PARAM.SFO by name, ignoring case", () => {
    const files = [file("param.sfo"), file("ICON0.PNG"), file("Data.bin")];
    expect(pickSaveFiles(files)).toEqual({ dataBin: files[2], paramSfo: files[0] });
  });

  it("returns null when one of them is missing", () => {
    expect(pickSaveFiles([file("DATA.BIN")])).toBeNull();
  });
});
