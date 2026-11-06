import { describe, expect, it, vi } from "vitest";
import { MAX_IDX_BYTES, MAX_LOC_BYTES, teamKey, textKey } from "../data/game-locale.ts";
import { MAX_SFO_BYTES } from "../data/param-sfo.ts";
import { MAX_DATA_BIN_BYTES } from "../data/read-save-data.ts";
import { buildLocale } from "../data/test-support/synthetic-locale.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { buildIso } from "../data/test-support/synthetic-iso.ts";
import { buildParamSfo } from "../data/test-support/synthetic-save.ts";
import { classifyLoadError, loadScout, pickLocaleFiles, pickSaveFiles } from "./load-scout.ts";
import type { LoadPhase } from "./load-scout.ts";
import {
  buildPlainSave,
  buildScoutDb,
  buildScoutLocale,
  SCOUT_USER_TEAM_ID,
} from "./test-support/scout-db.ts";
import { table } from "./test-support/player-fixtures.ts";

const blob = (bytes: Uint8Array): Blob => new Blob([bytes.slice()]);

describe("loadScout", () => {
  it("reads a bare fifa.db, reports the phases and returns the players and the database", async () => {
    const phases: LoadPhase[] = [];
    const db = buildScoutDb();
    const result = await loadScout({ game: blob(db) }, (phase) => phases.push(phase));
    expect(phases).toEqual(["game", "players"]);
    expect(result.players).toHaveLength(63);
    expect(result.myTeamId).toBeNull();
    expect(result.career).toBeNull();
    expect(result.gameDb).toEqual(db);
    expect(result.languages).toEqual({});
    expect(result.attachedLanguage).toBeNull();
  });

  const POLISH = {
    teams: { 10: "ŁKS Łódź" },
    leagues: { 53: "Liga BBVA (Hiszpania)", 76: "Reszta Świata" },
    countries: { 37: "Polska", 52: "Argentyna" },
    positions: { 0: "BR" },
    positionNames: {},
  };

  it("reads every language of a disc image for the database's ids", async () => {
    const { loc, idx } = buildScoutLocale();
    // The full position names sit in the cgexport directory; the main directory's texts win.
    const names = buildLocale([
      [textKey(1592), "Bramkarz"],
      [teamKey(10, 0), "Inna nazwa"],
    ]);
    const locale = "PSP_GAME/USRDIR/data/gui/locale";
    const iso = buildIso([
      {
        path: "PSP_GAME/PARAM.SFO",
        bytes: buildParamSfo([{ key: "DISC_ID", value: "ULES01328" }]),
      },
      { path: "PSP_GAME/USRDIR/data/cmn/fifa.db", bytes: buildScoutDb() },
      { path: `${locale}/string.idx`, bytes: idx },
      { path: `${locale}/pol_pl.loc`, bytes: loc },
      { path: `${locale}/eng_us.loc`, bytes: loc },
      { path: `${locale}/cgexport/string.idx`, bytes: names.idx },
      { path: `${locale}/cgexport/pol_pl.loc`, bytes: names.loc },
    ]);
    const result = await loadScout({ game: blob(iso) }, () => undefined);
    expect(result.languages).toEqual({
      eng_us: POLISH,
      pol_pl: { ...POLISH, positionNames: { 0: "Bramkarz" } },
    });
  });

  it("reads an attached language file with its index", async () => {
    const { loc, idx } = buildScoutLocale();
    const result = await loadScout(
      { game: blob(buildScoutDb()), locale: { code: "pol_pl", loc: blob(loc), idx: blob(idx) } },
      () => undefined,
    );
    expect(result.languages).toEqual({ pol_pl: POLISH });
    expect(result.attachedLanguage).toBe("pol_pl");
  });

  it("tags a bad language file with its own stage", async () => {
    const { idx } = buildScoutLocale();
    const locale = { code: "pol_pl", loc: blob(new Uint8Array(32)), idx: blob(idx) };
    await expect(
      loadScout({ game: blob(buildScoutDb()), locale }, () => undefined),
    ).rejects.toEqual(expect.objectContaining({ error: { stage: "locale", kind: "wrong-file" } }));
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
    expect(result.career).toMatchObject({
      managerName: "Anna Kariera",
      clubName: "Wisła Kraków",
      lastGameDate: new Date(Date.UTC(2009, 7, 8)),
      currency: 0,
      offer: { prestige: 0, negotiator: 0, seasonEndYear: 2010 },
    });
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

  it("blames the save when its tables break the players", async () => {
    // A career gain that is no number turns Brożek's attributes into NaN.
    const grown = table("career_players_grown_attributes", [
      { playerid: 7, potential_delta: 0, dribbling_delta: "x" },
    ]);
    const { dataBin, paramSfo } = buildPlainSave();
    const save = { dataBin: blob(dataBin), paramSfo: blob(paramSfo) };
    await expect(
      loadScout({ game: blob(buildScoutDb([grown])), save }, () => undefined),
    ).rejects.toEqual(expect.objectContaining({ error: { stage: "save", kind: "damaged" } }));
  });
});

/** A file one byte over `maxBytes` whose contents are never read. */
const oversized = (maxBytes: number) => {
  const file = blob(new Uint8Array(maxBytes + 1));
  return { file, read: vi.spyOn(file, "arrayBuffer") };
};

describe("loadScout size caps", () => {
  it.each([
    ["DATA.BIN", "dataBin", MAX_DATA_BIN_BYTES],
    ["PARAM.SFO", "paramSfo", MAX_SFO_BYTES],
  ] as const)("rejects a %s over its cap without reading it", async (_name, key, maxBytes) => {
    const { file, read } = oversized(maxBytes);
    const plain = buildPlainSave();
    const save = { dataBin: blob(plain.dataBin), paramSfo: blob(plain.paramSfo), [key]: file };
    await expect(loadScout({ game: blob(buildScoutDb()), save }, () => undefined)).rejects.toEqual(
      expect.objectContaining({ error: { stage: "save", kind: "wrong-file" } }),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    ["loc", MAX_LOC_BYTES],
    ["idx", MAX_IDX_BYTES],
  ] as const)("rejects an attached .%s over its cap without reading it", async (key, maxBytes) => {
    const { file, read } = oversized(maxBytes);
    const { loc, idx } = buildScoutLocale();
    const locale = { code: "pol_pl", loc: blob(loc), idx: blob(idx), [key]: file };
    await expect(
      loadScout({ game: blob(buildScoutDb()), locale }, () => undefined),
    ).rejects.toEqual(expect.objectContaining({ error: { stage: "locale", kind: "wrong-file" } }));
    expect(read).not.toHaveBeenCalled();
  });
});

describe("classifyLoadError", () => {
  it.each(["wrong-game", "wrong-file", "not-career", "damaged"] as const)(
    "takes the kind %s from the file error",
    (kind) => {
      expect(classifyLoadError("save", new SaveFormatError("x", kind))).toEqual({
        stage: "save",
        kind,
      });
    },
  );

  it("calls a file error without a kind damaged", () => {
    expect(classifyLoadError("game", new SaveFormatError("x"))).toEqual({
      stage: "game",
      kind: "damaged",
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

describe("pickLocaleFiles", () => {
  it("finds a .loc and string.idx and takes the language code from the file name", () => {
    const files = [file("string.IDX"), file("POL_PL.loc"), file("notes.txt")];
    expect(pickLocaleFiles(files)).toEqual({ code: "pol_pl", loc: files[1], idx: files[0] });
  });

  it("returns null when one of them is missing", () => {
    expect(pickLocaleFiles([file("pol_pl.loc")])).toBeNull();
    expect(pickLocaleFiles([file("string.idx")])).toBeNull();
  });
});
