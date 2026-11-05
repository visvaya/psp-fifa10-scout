// Hand-made inputs for the player logic tests: databases from plain rows and complete summaries.
import type { TableSpec } from "../../data/test-support/synthetic-ea-db.ts";
import { ATTRIBUTE_NAMES, attributesOf, searchKey, TRAIT_NAMES } from "../players.ts";
import type { Attributes, Player } from "../players.ts";
import { CURVE_COLUMNS } from "../overall-rating.ts";
import type { CareerSummary } from "../load-scout.ts";

type Row = Readonly<Record<string, number | string>>;

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

/** fifa.db `curves` with one flat curve (id 1, the game's fallback), so career ratings age nothing. */
/** A float32 as the u32 bits the save stores. */
export const floatBits = (value: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, true);
  return view.getUint32(0, true);
};

export const flatCurves = (): TableSpec =>
  table("curves", [
    Object.fromEntries([["id", 1], ...CURVE_COLUMNS.map((column) => [column, 50])]),
  ]);

/** Every attribute at `value`, with `overrides` on top. */
export const attributes = (value: number, overrides: Partial<Attributes> = {}): Attributes => ({
  ...attributesOf(Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, value]))),
  ...overrides,
});

/** A players row with every column the summary reads. */
export const playerRow = (overrides: Row): Row => ({
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
  offer: { prestige: 2, finance: 4, squadAverage: 65, countryId: 37, seasonEndYear: 2010 },
};

export const testPlayer = (overrides: Partial<Player> = {}): Player => {
  const player: Player = {
    id: 1,
    name: "First Last",
    initialName: "F. Last",
    searchName: "",
    nameOrder: 0,
    youth: false,
    freeAgent: false,
    age: 25,
    birthYear: 1984,
    positionCode: 17,
    positionName: "CM",
    positionGroup: "central-midfield",
    preferredFoot: "right",
    height: 180,
    weight: 75,
    potential: 70,
    peak: null,
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
    attributes: attributes(50),
    clubId: 10,
    clubName: "Club",
    clubRating: 60,
    leagueId: 100,
    leagueName: "League",
    contractEndYear: 2012,
    jerseyNumber: 8,
    nationalTeamId: null,
    nationalTeamName: null,
    nationalityId: 1,
    nationalityName: "Country",
    form: null,
    morale: null,
    goals: null,
    appearances: null,
    injuryDays: null,
    transferListed: false,
    shortlisted: false,
    clubWillSell: null,
    price: null,
    wage: null,
    wageMax: null,
    ...overrides,
  };
  return { ...player, searchName: searchKey(player.name) };
};
