// Hand-made inputs for the player logic tests: databases from plain rows and complete summaries.
import type { TableSpec } from "../../data/test-support/synthetic-ea-db.ts";
import { ATTRIBUTE_NAMES, attributesOf, searchKey } from "../players.ts";
import type { Attributes, Player } from "../players.ts";

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
  ...attributes(50),
  ...overrides,
});

/** A complete summary of a club player, with `overrides` on top. */
export const testPlayer = (overrides: Partial<Player> = {}): Player => {
  const player: Player = {
    id: 1,
    name: "First Last",
    searchName: "",
    nameOrder: 0,
    youth: false,
    age: 25,
    positionCode: 17,
    positionName: "CM",
    positionGroup: "central-midfield",
    preferredFoot: "right",
    height: 180,
    weight: 75,
    potential: 70,
    attributes: attributes(50),
    clubId: 10,
    clubName: "Club",
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
    ...overrides,
  };
  return { ...player, searchName: searchKey(player.name) };
};
