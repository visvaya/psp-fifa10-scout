// Hand-made inputs for the player logic tests: databases from plain rows and complete summaries.
import type { TableSpec } from "../../data/test-support/synthetic-ea-db.ts";
import { ATTRIBUTE_NAMES, attributesOf, searchKey, TRAIT_NAMES } from "../players.ts";
import type { Attributes, Player } from "../players.ts";
import { NO_BEST_PEAK } from "../best-peak.ts";
import { CURVE_COLUMNS } from "../overall-rating.ts";
import type { CareerSummary, LoadResult } from "../load-scout.ts";
import { NO_FINANCE } from "../player-finance.ts";

type Row = Readonly<Record<string, number | string>>;

/**
 * A career_players_grown_attributes row as real saves have it: potential_delta and every attribute's
 * delta column but tacticalawareness_delta, 0 unless `deltas` (keyed by column) gives one.
 */
export const grownRow = (playerid: number, deltas: Readonly<Record<string, number>> = {}): Row => ({
  playerid,
  potential_delta: 0,
  ...Object.fromEntries(
    ATTRIBUTE_NAMES.filter((name) => name !== "tacticalawareness").map((name) => [
      `${name}_delta`,
      0,
    ]),
  ),
  ...deltas,
});

/** Days since 1582-10-14, the epoch of fifa.db's birthdates and of the game's dates. */
export const daysSince1582 = (year: number, month: number, day: number): number =>
  (Date.UTC(year, month - 1, day) - Date.UTC(1582, 9, 14)) / 86_400_000;

/** A table whose numeric columns are u32 words and whose text columns are strings. */
export const table = (name: string, rows: readonly Row[]): TableSpec => {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const strings = columns.filter((column) => rows.some((row) => typeof row[column] === "string"));
  const u32 = columns.filter((column) => !strings.includes(column));
  return {
    name,
    u32,
    strings,
    rows: rows.map((row) => ({
      u32: u32.map((column) => Number(row[column])),
      strings: strings.map((column) => String(row[column])),
      area: [],
    })),
  };
};

/** The real Wisła save's 4-4-2 (formation 373): GK, LB, LCB, RCB, RB, LM, LCM, RCM, RM, LS, RS. */
export const FOUR_FOUR_TWO = [0, 7, 6, 4, 3, 19, 18, 16, 15, 31, 29];

/**
 * fifa.db `teamwrite` and `formations` giving `teamId` a formation of this starting eleven, then the
 * bench codes, as formation 373 has them.
 */
export const formationTables = (
  teamId: number,
  startingEleven: readonly number[] = FOUR_FOUR_TWO,
): readonly TableSpec[] => [
  table("teamwrite", [{ teamid: teamId, formationid: 373 }]),
  table("formations", [
    Object.fromEntries([
      ["formationid", 373],
      ...[...startingEleven, 32, 37].map((code, index) => [`position${String(index + 1)}`, code]),
    ]),
  ]),
];

/** fifa.db `curves` with one flat curve (id 1, the game's fallback), so career ratings age nothing. */
export const flatCurves = (): TableSpec =>
  table("curves", [
    Object.fromEntries([["id", 1], ...CURVE_COLUMNS.map((column) => [column, 50])]),
  ]);

/** A float32 as the u32 bits the save stores. */
export const floatBits = (value: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
};

/** Every attribute at `value`, with `overrides` on top. */
export const attributes = (value: number, overrides: Partial<Attributes> = {}): Attributes => ({
  ...attributesOf(Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, value]))),
  ...overrides,
});

/** A players row with every column the summary reads. */
export const playerRow = (overrides: Row): Row => ({
  // Data rows, alike by nature. jscpd:ignore-start
  playerid: 1,
  firstname: "First",
  surname: "Last",
  birthdate: 147_811,
  nationality: 1,
  preferredposition1: 0,
  preferredfoot: 0,
  height: 180,
  weight: 75,
  potential: 70,
  developmenttypecode: 1,
  developmentstylecode: 2,
  bodysizecode: 2,
  weakfootability: 2,
  internationalreputation: 1,
  learningspeed: 3,
  retirementage: 35,
  playingstyle: 13,
  // jscpd:ignore-end
  ...Object.fromEntries(TRAIT_NAMES.map((name) => [name, 0])),
  ...attributes(50),
  ...overrides,
});

/** A complete summary of a club player, with `overrides` on top. */
/** A loaded career, for state tests. */
export const TEST_CAREER: CareerSummary = {
  managerName: "A",
  clubName: "B",
  lastGameDate: new Date(0),
  currency: 0,
  offer: { prestige: 2, negotiator: 4, squadAverage: 65, countryId: 37, seasonEndYear: 2010 },
  formationCodes: [],
};

/** A finished load of a game with no players and no career save. */
export const EMPTY_LOAD_RESULT: LoadResult = {
  players: [],
  myTeamId: null,
  career: null,
  curves: new Map(),
  gameDb: Uint8Array.of(9),
  languages: {},
  attachedLanguage: null,
};

/** A player without a season in the save. */
export const NO_STATS = {
  form: null,
  morale: null,
  goals: null,
  appearances: null,
  cupAppearances: null,
  cupGoals: null,
  assists: null,
  cupAssists: null,
  cleanSheets: null,
  cupCleanSheets: null,
  injuryDays: null,
} as const;

const NO_PEAKS = { peak: null, peakGain: null, ...NO_BEST_PEAK } as const;

/** A club player's club fields. */
const CLUB = {
  clubId: 10,
  clubName: "Club",
  clubRating: 60,
  clubStars: 2,
  leaguePrestige: 10,
  clubPrestige: 5,
  leagueId: 100,
  leagueName: "League",
  contractEndYear: 2012,
  jerseyNumber: 8,
  nationalTeamId: null,
  nationalTeamName: null,
} as const;

export const testPlayer = (overrides: Partial<Player> = {}): Player => {
  const player: Player = {
    id: 1,
    name: "First Last",
    initialName: "F. Last",
    searchName: "",
    nameOrder: 0,
    youth: false,
    academy: false,
    freeAgent: false,
    age: 25,
    seasonAge: 25,
    birthYear: 1984,
    positionCode: 17,
    positionName: "CM",
    positionGroup: "central-midfield",
    preferredFoot: "right",
    height: 180,
    weight: 75,
    potential: 70,
    ...NO_PEAKS,
    overall: 50,
    growth: 20,
    bodyType: 2,
    weakFoot: 3,
    internationalReputation: 1,
    learningSpeed: 3,
    retirementAge: 35,
    developmentType: 1,
    developmentStyle: 2,
    traits: [],
    overallByCode: Array.from({ length: 32 }, () => 50),
    peakByCode: [],
    attributes: attributes(50),
    ...CLUB,
    nationalityId: 1,
    nationalityName: "Country",
    ...NO_STATS,
    transferListed: false,
    loanListed: false,
    loanedFromId: null,
    loanedFromName: null,
    loanedFromRating: null,
    shortlisted: false,
    clubWillSell: null,
    saleRefusal: null,
    ...NO_FINANCE,
    ...overrides,
  };
  return { ...player, searchName: searchKey(player.name) };
};
