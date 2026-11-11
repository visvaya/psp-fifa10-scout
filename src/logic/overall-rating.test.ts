import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectiveRows, careerManager, parseCareerSave } from "../data/career-save.ts";
import { birthdateToDate, parseEaDb, readTable } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import {
  attributeGains,
  baseOverall,
  byPositionCode,
  cappedOverall,
  careerAgeing,
  OVR_WEIGHTS,
  overallsByAge,
  peaksByPositionCode,
  potentialDeltas,
  readCurves,
} from "./overall-rating.ts";
import type { CareerRatingInput, Curves } from "./overall-rating.ts";
import { attributesOf } from "./players.ts";
import { attributes, flatCurves, grownRow, table } from "./test-support/player-fixtures.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";

const GK = 0;
const CB = 5;
const CDM = 11;
const LM = 19;
const CM = 17;
const CAM = 23;
const ST = 30;

describe("OVR weights", () => {
  it("has 32 position codes, each summing to 1 within float32 precision", () => {
    expect(OVR_WEIGHTS).toHaveLength(32);
    for (const row of OVR_WEIGHTS) {
      expect(row.length).toBeLessThanOrEqual(7);
      const sum = row.reduce((total, [, weight]) => total + Math.fround(weight), 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
    }
  });

  it("holds the stored weights of each group", () => {
    expect(OVR_WEIGHTS[ST]).toContainEqual(["finishing", 0.267]);
    expect(OVR_WEIGHTS[CB]).toContainEqual(["heading", 0.2]);
    expect(OVR_WEIGHTS[1]?.[3]).toEqual(["shortpassing", 0.1]);
    expect(OVR_WEIGHTS[3]?.[3]).toEqual(["ballcontrol", 0.2]);
    expect(OVR_WEIGHTS[2]).toBe(OVR_WEIGHTS[8]);
    expect(OVR_WEIGHTS[14]).toBe(OVR_WEIGHTS[20]);
    expect(OVR_WEIGHTS[16]).toBe(OVR_WEIGHTS[CM]);
  });
});

describe("byPositionCode", () => {
  it("rates each code once per distinct weight row", () => {
    const rated: number[] = [];
    const values = byPositionCode((code) => {
      rated.push(code);
      return code * 2;
    });
    expect(rated).toEqual([0, 1, 2, 3, 4, 9, 14, 16, 21, 26]);
    expect(values).toHaveLength(32);
    expect(values.slice(0, 9)).toEqual([0, 2, 4, 6, 8, 8, 8, 6, 4]);
    expect(values.slice(14, 21)).toEqual([28, 28, 32, 32, 32, 28, 28]);
    expect(values[31]).toBe(52);
  });
});

describe("baseOverall", () => {
  it("rates even attributes at their value at every position", () => {
    for (const code of OVR_WEIGHTS.keys()) expect(baseOverall(attributes(64), code)).toBe(64);
  });

  it("weights the attributes of each position group", () => {
    expect(baseOverall(attributes(50, { handling: 90 }), GK)).toBe(59);
    expect(baseOverall(attributes(50, { marking: 90 }), CB)).toBe(60);
    expect(baseOverall(attributes(50, { tackling: 90 }), CDM)).toBe(58);
    expect(baseOverall(attributes(50, { dribbling: 90 }), LM)).toBe(58);
    expect(baseOverall(attributes(50, { longpassing: 90 }), CM)).toBe(55);
    expect(baseOverall(attributes(50, { shortpassing: 90 }), CAM)).toBe(60);
    expect(baseOverall(attributes(50, { finishing: 90 }), ST)).toBe(61);
    expect(baseOverall(attributes(50, { gkdiving: 90 }), ST)).toBe(50);
  });

  it("rounds half up", () => {
    expect(baseOverall(attributes(50, { crossing: 52 }), LM)).toBe(51);
    expect(baseOverall(attributes(50, { crossing: 51 }), LM)).toBe(50);
    expect(baseOverall(attributes(50, { crossing: 53 }), LM)).toBe(51);
  });

  it("clamps to 0..99", () => {
    expect(baseOverall(attributes(150), ST)).toBe(99);
    expect(baseOverall(attributes(-20), ST)).toBe(0);
  });

  it("rejects a code without weights", () => {
    expect(() => baseOverall(attributes(50), 32)).toThrow(/No OVR weights for position 32/);
  });
});

// Curve values for ages 15..45, with `at` overriding single ages.
const curve = (value: number, at: Readonly<Record<number, number>> = {}): readonly number[] =>
  Array.from({ length: 31 }, (_, index) => at[index + 15] ?? value);

// Born 1989-01-01: 20 on 2009-01-01, 21 on 2010-03-01.
const player = (overrides: Partial<CareerRatingInput> = {}): CareerRatingInput => ({
  attributes: attributes(50),
  potential: 99,
  birthdate: new Date("1989-01-01"),
  developmentTypeCode: 1,
  developmentStyleCode: 2,
  ...overrides,
});
const LATER = new Date("2010-03-01");
// Type 1, style 2: skills follow curve 3 * 2 + 1 - 4 = 3, physical attributes curve 1 + 14 = 15.
const CURVES: Curves = new Map([
  [1, curve(50)],
  [3, curve(50, { 21: 60 })],
  [15, curve(50, { 21: 40 })],
]);

/** Curve 3 for skills with `at` overrides; everything else on the flat fallback curve 1. */
const skillCurve = (at: Readonly<Record<number, number>>): Curves =>
  new Map([
    [1, curve(50)],
    [3, curve(50, at)],
  ]);

/** OVR at a position on a career date, as players.ts composes it. */
const careerOverall = (
  input: CareerRatingInput,
  positionCode: number,
  date: Date,
  curves: Curves,
): number =>
  cappedOverall(careerAgeing(input, date, curves).attributesIn(0), positionCode, input.potential);

describe("careerAgeing", () => {
  it("ages each attribute along its curve, as the game shows them in a career", () => {
    const aged = careerAgeing(player(), LATER, CURVES).attributesIn(0);
    expect([aged("finishing"), aged("sprintspeed"), aged("reflexes")]).toEqual([60, 40, 40]);
  });

  it("ages a player some years further, as the game's OVR in five years", () => {
    // Age 16 on 2005-03-01, rated as 21: the curves' values at 21.
    const later = careerAgeing(player(), new Date("2005-03-01"), CURVES).attributesIn(5);
    expect([later("finishing"), later("sprintspeed")]).toEqual([60, 40]);
  });
});

describe("careerOverall", () => {
  it("ages skills and physical attributes along their own curves", () => {
    // Striker: skills 0.8 x 60, sprintspeed and stamina 0.2 x 40.
    expect(careerOverall(player(), ST, LATER, CURVES)).toBe(56);
    expect(careerOverall(player(), GK, LATER, CURVES)).toBe(54); // reflexes count as physical
  });

  it("leaves the attributes as they are on the reference date", () => {
    expect(careerOverall(player(), ST, new Date("2009-06-01"), CURVES)).toBe(50);
  });

  it("falls back to curve 1 for an unknown curve id", () => {
    expect(careerOverall(player({ developmentStyleCode: 9 }), ST, LATER, CURVES)).toBe(48);
  });

  it("clamps ages to the curve's 15..44 range", () => {
    const young = player({ birthdate: new Date("2000-01-01") });
    expect(careerOverall(young, ST, LATER, skillCurve({ 15: 25 }))).toBe(50);
    const old = player({ birthdate: new Date("1950-01-01") });
    expect(careerOverall(old, ST, LATER, skillCurve({ 44: 25 }))).toBe(50);
  });

  it("caps the rating and each aged attribute at the potential", () => {
    expect(careerOverall(player({ potential: 55 }), ST, LATER, CURVES)).toBe(52); // skills 55, physical 40
    // Skills would reach 60 but stop at max(potential, value) = 52.
    const capped = player({ potential: 52 });
    expect(careerOverall(capped, CAM, LATER, skillCurve({ 21: 60 }))).toBe(52);
  });

  it("keeps an attribute above the potential and aged ones at 10..99", () => {
    expect(
      careerOverall(player({ attributes: attributes(80), potential: 70 }), ST, LATER, CURVES),
    ).toBe(70);
    const falling = new Map([
      [3, curve(50, { 21: 5 })],
      [15, curve(50, { 21: 5 })],
    ]);
    expect(careerOverall(player(), ST, LATER, falling)).toBe(10);
    const rising = new Map([
      [3, curve(20, { 21: 60 })],
      [15, curve(20, { 21: 60 })],
    ]);
    expect(careerOverall(player(), ST, LATER, rising)).toBe(99);
  });
});

/** The peaks of the test player, 21 on LATER, on the given curves. */
const peaks = (curves: Curves, input = player()): readonly number[] =>
  peaksByPositionCode(careerAgeing(input, LATER, curves), input.potential);
// Skills peak at 24, the physical curve at 22: each position peaks in its own season.
const RISING: Curves = new Map([
  [1, curve(50)],
  [3, curve(50, { 22: 55, 23: 60, 24: 62, 25: 58 })],
  [15, curve(50, { 22: 70, 23: 52 })],
]);
/** The test player's OVR at a position when he is `age`. */
const at = (age: number, code: number, curves = RISING): number =>
  careerOverall(player(), code, new Date(`${String(1989 + age)}-03-01`), curves);

// Owner, 2026-11-07: the large development chart's axis in OVR, his OVR at each age of the curves.
describe("overallsByAge", () => {
  it("rates each age from his age this season to 45 as the player would be then", () => {
    // The test player is 21 on LATER: 25 ages, 21 to 45.
    const byAge = overallsByAge(careerAgeing(player(), LATER, RISING), ST, player().potential);
    expect(byAge).toHaveLength(25);
    for (const age of [21, 22, 24, 30, 45]) expect(byAge[age - 21]).toBe(at(age, ST));
    expect(byAge[24 - 21]).toBeGreaterThan(byAge[0] ?? 99);
  });
});

describe("peaksByPositionCode", () => {
  it("takes at each position the OVR of his best season there", () => {
    const result = peaks(RISING);
    expect(result[ST]).toBe(Math.max(at(21, ST), at(22, ST), at(23, ST), at(24, ST), at(25, ST)));
    expect(result[ST]).toBe(at(24, ST));
    expect(result[GK]).toBe(at(22, GK));
    expect(result).toHaveLength(32);
    // The two positions peak in different seasons.
    expect([at(24, ST) > at(22, ST), at(22, GK) > at(24, GK)]).toEqual([true, true]);
  });

  it("keeps today's OVR for a player whose curves only fall", () => {
    const falling: Curves = new Map([
      [3, curve(50, { 22: 45, 23: 40 })],
      [15, curve(50, { 22: 45, 23: 40 })],
    ]);
    expect(peaks(falling)[CM]).toBe(careerOverall(player(), CM, LATER, falling));
  });

  it("counts a late rise within the projection, and none beyond it", () => {
    // 21 now: a rise at 40 is 19 seasons ahead, one at 44 is 23 seasons ahead, past the 20 projected.
    const late = skillCurve({ 40: 70 });
    expect(peaks(late)[CAM]).toBe(at(40, CAM, late));
    expect(peaks(late)[CAM]).toBeGreaterThan(at(21, CAM, late));
    const beyond = skillCurve({ 44: 70 });
    expect(peaks(beyond)[CAM]).toBe(at(21, CAM, beyond));
  });

  it("stops at the potential", () => {
    const strong = player({ attributes: attributes(80), potential: 70 });
    expect(peaks(skillCurve({ 24: 70 }), strong)[CAM]).toBe(70);
  });
});

describe("careerAgeing growth seasons", () => {
  it("counts the seasons until the player's curves last rise", () => {
    expect(careerAgeing(player(), LATER, skillCurve({ 30: 60 })).growthSeasons).toBe(9);
    expect(careerAgeing(player(), LATER, skillCurve({ 18: 60 })).growthSeasons).toBe(0);
  });
});

describe("readCurves and potentialDeltas", () => {
  it("read the curves by id and the save's potential deltas by player", () => {
    const db = parseEaDb(
      buildEaDb([
        flatCurves(),
        table("career_players_grown_attributes", [{ playerid: 3, potential_delta: 0 }]),
      ]),
    );
    expect(readCurves(db)).toEqual(new Map([[1, curve(50)]]));
    const save = new Map([
      ["career_players_grown_attributes", [{ playerid: 7, potential_delta: 6 }]],
    ]);
    expect(potentialDeltas(db, save)).toEqual(new Map([[7, 6]]));
  });
});

/** Player 7's gains from a save holding one grown-attributes row. */
const gainsOf = (row: EaDbRow) =>
  attributeGains(
    parseEaDb(
      buildEaDb([table("career_players_grown_attributes", [{ playerid: 0, potential_delta: 0 }])]),
    ),
    new Map([["career_players_grown_attributes", [row]]]),
  ).get(7);

describe("attributeGains", () => {
  it("reads each attribute's delta; tactical awareness, which the game has no column for, gains 0", () => {
    const gain = gainsOf(grownRow(7, { finishing_delta: 2 }));
    expect(gain?.("finishing")).toBe(2);
    expect(gain?.("tacticalawareness")).toBe(0);
  });

  it("throws a file error when another attribute's delta column is missing", () => {
    const { dribbling_delta: _missing, ...row } = grownRow(7);
    expect(() => gainsOf(row)?.("dribbling")).toThrow(SaveFormatError);
  });
});

// Game data never enters the repository. FIFA_DB_PATH and PSP_CAREER_SAVE (plain DATA.BIN) point at
// local copies.
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const realCareerPath = process.env["PSP_CAREER_SAVE"] ?? "";

const loadReal = () => {
  const db = parseEaDb(readFileSync(realDbPath));
  return {
    db,
    players: new Map(readTable(db, "players").map((row) => [Number(row["playerid"]), row])),
  };
};

describe.runIf(existsSync(realDbPath))("real fifa.db", () => {
  it("gives the known base ratings", () => {
    const { players } = loadReal();
    const byName = (name: string) =>
      [...players.values()].find(
        (row) => `${String(row["firstname"])} ${String(row["surname"])}` === name,
      );
    const rate = (name: string) => {
      const row = byName(name);
      return row && baseOverall(attributesOf(row), Number(row["preferredposition1"]));
    };
    expect(rate("Lionel Messi")).toBe(89);
    expect(rate("Wayne Rooney")).toBe(90);
    expect(rate("Robert Lewandowski")).toBe(73);
  });

  it.runIf(existsSync(realCareerPath))("matches the save's stored ratings", () => {
    const { db, players } = loadReal();
    const save = parseCareerSave(db, readFileSync(realCareerPath));
    const curves = readCurves(db);
    const deltas = potentialDeltas(db, save);
    const now = careerManager(db, save).lastGameDate;
    if (now === null) throw new Error("The real save has played games");
    const rate = (id: number): number => {
      const row = players.get(id);
      if (row === undefined) throw new Error(`No player ${String(id)}`);
      const input: CareerRatingInput = {
        attributes: attributesOf(row),
        potential: Number(row["potential"]) + (deltas.get(id) ?? 0),
        birthdate: birthdateToDate(Number(row["birthdate"])),
        developmentTypeCode: Number(row["developmenttypecode"]),
        developmentStyleCode: Number(row["developmentstylecode"]),
      };
      return careerOverall(input, Number(row["preferredposition1"]), now, curves);
    };
    const exact = (refs: readonly (readonly [number, number])[]) =>
      refs.filter(([id, stored]) => rate(id) === stored).length;
    const squad = effectiveRows(db, save, "career_overall_history").map(
      (row) => [Number(row["playerid"]), Number(row["season0"])] as const,
    );
    const listed = effectiveRows(db, save, "career_transfer_list").map(
      (row) => [Number(row["playerid"]), Number(row["overall_rating"])] as const,
    );
    expect(exact(squad)).toBe(23);
    const total = exact([...squad, ...listed]);
    process.stdout.write(
      `OVR exact at the preferred position: ${String(total)} of ${String(squad.length + listed.length)}\n`,
    );
    expect(total).toBeGreaterThanOrEqual(302);
  });
});
