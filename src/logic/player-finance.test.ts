import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCareerSave } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { parseEaDb } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";
import { buildEaDb } from "../data/test-support/synthetic-ea-db.ts";
import { baseOverall, CURVE_COLUMNS } from "./overall-rating.ts";
import { buildPlayers } from "./players.ts";
import type { Player } from "./players.ts";
import { attributes, playerRow, table } from "./test-support/player-fixtures.ts";
import { marketWage, roundPrice, transferPrice } from "./transfer-price.ts";
import type { PriceInput } from "./transfer-price.ts";

const daysSince1582 = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1582, 9, 14)) / 86_400_000;

/** Every attribute 50 but tackling and marking 80: centre-backs rate far above strikers. */
const DEFENDER = attributes(50, { tackling: 80, marking: 80 });
const FREE_AGENT_TEAM = 111_259;

/** A `curves` row: the value at each age 15..45. */
const curveRow = (id: number, value: (age: number) => number) => ({
  id,
  ...Object.fromEntries(CURVE_COLUMNS.map((column, index) => [column, value(15 + index)])),
});

/** OVR as a striker now, and in five years with skills 40 % higher (at most the potential 90). */
const OVERALL = baseOverall(DEFENDER, 29);
const OVERALL_IN_5_YEARS = baseOverall(
  attributes(70, {
    tackling: 90,
    marking: 90,
    sprintspeed: 50,
    stamina: 50,
    acceleration: 50,
    strength: 50,
    reflexes: 50,
  }),
  29,
);
const USER_TEAM = 1873;

const DB = parseEaDb(
  buildEaDb([
    table("leagues", [{ leagueid: 53, leaguename: "League", level: 1, leagueprestige: 12 }]),
    table("teams", [
      { teamid: 241, teamname: "Club", overallrating: 80, internationalprestige: 9 },
      { teamid: USER_TEAM, teamname: "User", overallrating: 60, internationalprestige: 4 },
    ]),
    table("leagueteamlinks", [
      { leagueid: 53, teamid: 241 },
      { leagueid: 53, teamid: USER_TEAM },
    ]),
    table("country", [{ countryid: 1, countryname: "Country" }]),
    table(
      "players",
      [1, 3, 4, 5, 6].map((playerid) =>
        playerRow({
          playerid,
          birthdate: daysSince1582(1985, 1, 15),
          preferredposition1: 29,
          potential: 90,
          playingstyle: 3,
          internationalreputation: 2,
          ...DEFENDER,
        }),
      ),
    ),
    table("teamplayerlinks", [
      { teamid: 241, playerid: 1, jerseynumber: 1, yearcontractvalidtil: 2012 },
    ]),
    ...["playerstats", "career_youth_accademy", "career_transfer_list"].map((name) => ({
      name,
      u32: ["playerid"],
      rows: [],
    })),
    table("career_players_grown_attributes", [{ playerid: 0, potential_delta: 0 }]),
    // Skills (curve 3) rise by 40 % from age 29: only the OVR in five years grows.
    table("curves", [curveRow(1, () => 50), curveRow(3, (age) => (age >= 29 ? 70 : 50))]),
  ]),
);

const row = (values: Readonly<Record<string, number | string>>): EaDbRow => Object.freeze(values);

const link = (playerid: number, teamid: number, year: number): EaDbRow =>
  row({ playerid, teamid, jerseynumber: playerid, yearcontractvalidtil: year });

/** A float32 as the u32 bits the save stores. */
const floatBits = (value: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
};

const SAVE: CareerSave = new Map([
  [
    "team_manager",
    [
      row({
        team_id: USER_TEAM,
        firstname: "A",
        surname: "B",
        last_game_number: daysSince1582(2009, 7, 25) * 1024,
      }),
    ],
  ],
  [
    "teamplayerlinks",
    [
      link(1, 241, 2012),
      link(3, 241, 2009),
      link(4, USER_TEAM, 2011),
      link(5, FREE_AGENT_TEAM, 2009),
    ],
  ],
  [
    "career_extra_user_team_info",
    [row({ playerid: 4, wage: floatBits(1234), bonus: 0, bonus_type: 0, contract_status: 0 })],
  ],
]);

const careerPlayers = (): readonly Player[] => buildPlayers(DB, SAVE);
const byId = (id: number): Player | undefined => careerPlayers().find((player) => player.id === id);

/** Age 24 on 2009-07-25, three years left at a club of prestige 12 + 9. */
const input = (overrides: Partial<PriceInput> = {}): PriceInput => ({
  positionCode: 29,
  overall: OVERALL,
  overallIn5Years: OVERALL_IN_5_YEARS,
  age: 24,
  contractYearsLeft: 3,
  internationalReputation: 2,
  playingStyle: 3,
  prestige: 21,
  ...overrides,
});

describe("career prices and wages", () => {
  it("prices a club player at his preferred position, now and in five years", () => {
    expect(OVERALL_IN_5_YEARS).toBeGreaterThan(OVERALL);
    expect(byId(1)).toMatchObject({
      overall: OVERALL,
      price: transferPrice(input()),
      wage: marketWage(input(), false),
      wageMax: marketWage(input(), false),
    });
  });

  it("prices a run-out contract at 0, its wage with and without the free-transfer factor", () => {
    const expired = input({ contractYearsLeft: 0 });
    expect(byId(3)).toMatchObject({
      price: 0,
      wage: marketWage(expired, false),
      wageMax: marketWage(expired, true),
    });
  });

  it("keeps the stored wage of the user's squad", () => {
    expect(byId(4)).toMatchObject({ wage: 1234, wageMax: null });
    expect(byId(4)?.price).toBe(transferPrice(input({ contractYearsLeft: 2, prestige: 16 })));
  });

  it("gives a free agent prestige from his OVR", () => {
    const free = input({ contractYearsLeft: 0, prestige: 2 * Math.floor(OVERALL / 5) });
    expect(byId(5)).toMatchObject({
      price: 0,
      wage: marketWage(free, false),
      wageMax: marketWage(free, true),
    });
  });

  it("leaves players without a club or without a save unpriced", () => {
    expect(byId(6)).toMatchObject({ price: null, wage: null, wageMax: null });
    const base = buildPlayers(DB).find((player) => player.id === 1);
    expect(base).toMatchObject({ price: null, wage: null, wageMax: null });
  });
});

// Game data never enters the repository. FIFA_DB_PATH and PSP_CAREER_SAVE (plain DATA.BIN) point at
// local copies; PSP_PRICE_REFERENCE at a JSON list of [player id, price] pairs read off the game's
// transfer-market screen for that save.
const realDbPath = process.env["FIFA_DB_PATH"] ?? "";
const realCareerPath = process.env["PSP_CAREER_SAVE"] ?? "";
const referencePath = process.env["PSP_PRICE_REFERENCE"] ?? "";

const as32 = (bits: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
};

/** CPU fees are the unrounded price times 0.85..1.24 (CPU_BUY_PRICE_RANGE), then rounded; the price
 * and the fee are each rounded to two significant digits, which moves them by up to 5 % each. */
const CPU_FEE_RATIO = { lowest: 0.85, highest: 1.24, rounding: 0.05 } as const;

const isPricePair = (item: unknown): item is [number, number] =>
  Array.isArray(item) && item.length === 2 && item.every((value) => Number.isFinite(value));

const loadReal = () => {
  const db = parseEaDb(readFileSync(realDbPath));
  const save = parseCareerSave(db, readFileSync(realCareerPath));
  return { db, save };
};

const realPlayers = (): ReadonlyMap<number, Player> => {
  const { db, save } = loadReal();
  return new Map(buildPlayers(db, save).map((player) => [player.id, player]));
};

describe.runIf(existsSync(realDbPath) && existsSync(realCareerPath))("real career prices", () => {
  it("prices every club player with rounded prices", () => {
    const players = realPlayers();
    const priced = [...players.values()].filter((player) => player.price !== null);
    expect(priced.length).toBeGreaterThan(10_000);
    expect(priced.every((player) => roundPrice(player.price ?? -1) === player.price)).toBe(true);
    expect(priced.every((player) => (player.wage ?? 0) > 0)).toBe(true);
  });

  it.runIf(existsSync(referencePath))("matches the prices on the game's screen", () => {
    const players = realPlayers();
    const parsed: unknown = JSON.parse(readFileSync(referencePath, "utf8"));
    const reference = new Map(Array.isArray(parsed) ? parsed.filter(isPricePair) : []);
    const exact = [...reference].filter(([id, price]) => players.get(id)?.price === price);
    process.stdout.write(`Screen prices exact: ${String(exact.length)} of ${String(reference.size)}
`);
    expect(reference.size).toBeGreaterThan(0);
    expect(exact).toHaveLength(reference.size);
  });

  it("explains every CPU transfer fee in the save within the CPU's price band", () => {
    const { db, save } = loadReal();
    // A sold player's fee is priced at his old club with the fifa.db contract, on the save's date.
    const sold = (save.get("career_transfer_list") ?? []).filter(
      (entry) => Number(entry["sold"]) === 1 && as32(Number(entry["paid"])) > 1,
    );
    const atOldClub = buildPlayers(
      db,
      new Map([...save].filter(([name]) => name !== "teamplayerlinks")),
    );
    const before = new Map(atOldClub.map((player) => [player.id, player.price ?? 0]));
    const { lowest, highest, rounding } = CPU_FEE_RATIO;
    const ratios = sold.map(
      (entry) => as32(Number(entry["paid"])) / (before.get(Number(entry["playerid"])) ?? 0),
    );
    const fits = ratios.filter(
      (ratio) =>
        ratio >= (lowest * (1 - rounding)) / (1 + rounding) &&
        ratio <= (highest * (1 + rounding)) / (1 - rounding),
    );
    process.stdout.write(`CPU fees within the band: ${String(fits.length)} of ${String(sold.length)}
`);
    expect(fits).toHaveLength(sold.length);
  });

  it("keeps the stored wages of the user's squad", () => {
    const { db, save } = loadReal();
    const players = new Map(buildPlayers(db, save).map((player) => [player.id, player]));
    const stored = save.get("career_extra_user_team_info") ?? [];
    const kept = stored.filter((entry) => {
      const player = players.get(Number(entry["playerid"]));
      return player?.wage === Math.round(as32(Number(entry["wage"]))) && player.wageMax === null;
    });
    expect(stored.length).toBeGreaterThan(0);
    expect(kept).toHaveLength(stored.length);
  });
});
