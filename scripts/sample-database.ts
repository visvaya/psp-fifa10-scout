// A fifa.db for the start page's screenshots: invented clubs, leagues, countries and players, with attributes
// that follow each position, drawn from a seeded generator (the same bytes on every run). It holds no real
// player or club. The browser tests keep their own, hand-made database (src/logic/test-support/scout-db.ts).
import { buildEaDb } from "../src/data/test-support/synthetic-ea-db.ts";
import { ATTRIBUTE_NAMES } from "../src/logic/players.ts";
import type { AttributeName } from "../src/logic/players.ts";
import {
  daysSince1582,
  flatCurves,
  playerRow,
  table,
} from "../src/logic/test-support/player-fixtures.ts";

const SEED = 20_091_010;
const PLAYER_COUNT = 48;
const FIRST_PLAYER_ID = 5000;

const FIRST_NAMES = [
  "Marek",
  "Tomas",
  "Luca",
  "Daniel",
  "Mateo",
  "Andrei",
  "Piotr",
  "Jonas",
] as const;
const SURNAME_STARTS = [
  "Kor",
  "Val",
  "Mar",
  "Tren",
  "Bel",
  "Dra",
  "Sen",
  "Vol",
  "Ras",
  "Nor",
] as const;
const SURNAME_ENDS = ["dic", "vek", "lin", "tov", "ren", "sko", "mar", "dal"] as const;

const COUNTRIES = [
  { countryid: 301, countryname: "Valdoria" },
  { countryid: 302, countryname: "Norland" },
  { countryid: 303, countryname: "Estmark" },
];
const LEAGUES = [
  { leagueid: 901, leaguename: "Northland League (1)", level: 1, leagueprestige: 12 },
  { leagueid: 902, leaguename: "Eastern Division (1)", level: 1, leagueprestige: 8 },
];
export const CLUBS = [
  { teamid: 2001, teamname: "FC Karmin", leagueid: 901, overallrating: 74 },
  { teamid: 2002, teamname: "Rovina United", leagueid: 901, overallrating: 70 },
  { teamid: 2003, teamname: "Atletico Verde", leagueid: 901, overallrating: 66 },
  { teamid: 2004, teamname: "Borealis City", leagueid: 901, overallrating: 62 },
  { teamid: 2005, teamname: "Dinamo Torvik", leagueid: 902, overallrating: 64 },
  { teamid: 2006, teamname: "SC Lunda", leagueid: 902, overallrating: 60 },
  { teamid: 2007, teamname: "Olimp Kessel", leagueid: 902, overallrating: 57 },
  { teamid: 2008, teamname: "Real Montara", leagueid: 902, overallrating: 55 },
];

type Role = "keeper" | "defender" | "midfielder" | "attacker";

/** The preferred positions the players cycle through (fifa.db codes) and the role of each. */
const POSITIONS: readonly (readonly [number, Role])[] = [
  [0, "keeper"],
  [5, "defender"],
  [7, "defender"],
  [11, "midfielder"],
  [15, "midfielder"],
  [17, "midfielder"],
  [23, "midfielder"],
  [29, "attacker"],
];

/** The attributes a role is good at; the others stay low. */
const STRONG: Readonly<Record<Role, readonly AttributeName[]>> = {
  keeper: ["gkdiving", "gkpositioning", "handling", "reflexes"],
  defender: ["tackling", "marking", "heading", "strength", "aggression"],
  midfielder: ["shortpassing", "longpassing", "ballcontrol", "tacticalawareness", "stamina"],
  attacker: ["finishing", "shotpower", "acceleration", "sprintspeed", "positioning"],
};

const MIN_ATTRIBUTE = 15;
const MAX_ATTRIBUTE = 95;
const WEAK_BASE = 28;
const STRONG_BASE = 48;
const SKILL_SPREAD = 32;
const NOISE = 10;

/** mulberry32: a small seeded generator returning numbers in [0, 1). */
const seeded = (seed: number): (() => number) => {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
};

const clamp = (value: number): number =>
  Math.min(MAX_ATTRIBUTE, Math.max(MIN_ATTRIBUTE, Math.round(value)));

const playerAt = (index: number, random: () => number) => {
  const [position, role] = POSITIONS[index % POSITIONS.length] ?? POSITIONS[0] ?? [0, "keeper"];
  const skill = random();
  const strong = new Set<string>(STRONG[role]);
  const keeping = new Set<string>(STRONG.keeper);
  const attributes = Object.fromEntries(
    ATTRIBUTE_NAMES.map((name) => [
      name,
      // An outfield player has next to no goalkeeping, whatever his skill.
      role !== "keeper" && keeping.has(name)
        ? clamp(MIN_ATTRIBUTE + random() * NOISE)
        : clamp(
            (strong.has(name) ? STRONG_BASE : WEAK_BASE) +
              skill * SKILL_SPREAD +
              (random() - 0.5) * NOISE * 2,
          ),
    ]),
  );
  const birthYear = 1974 + Math.floor(random() * 19);
  const youth = 2009 - birthYear < 22;
  return playerRow({
    ...attributes,
    playerid: FIRST_PLAYER_ID + index,
    firstname: FIRST_NAMES[(index * 5 + Math.floor(index / 8)) % FIRST_NAMES.length] ?? "Marek",
    surname: `${SURNAME_STARTS[index % SURNAME_STARTS.length] ?? "Kor"}${SURNAME_ENDS[(index * 3 + Math.floor(index / 10)) % SURNAME_ENDS.length] ?? "dic"}`,
    birthdate: daysSince1582(birthYear, 1, 15),
    nationality: COUNTRIES[index % COUNTRIES.length]?.countryid ?? 301,
    preferredposition1: position,
    height: 170 + Math.floor(random() * 25),
    weight: 65 + Math.floor(random() * 22),
    potential: clamp(50 + skill * 30 + (youth ? 8 + random() * 8 : random() * 3)),
  });
};

/** The sample database: the tables the app needs to list players, without any career. */
export const buildSampleDb = (): Uint8Array => {
  const random = seeded(SEED);
  const players = Array.from({ length: PLAYER_COUNT }, (_, index) => playerAt(index, random));
  return buildEaDb([
    table("leagues", LEAGUES),
    table(
      "teams",
      CLUBS.map(({ teamid, teamname, overallrating }) => ({
        teamid,
        teamname,
        overallrating,
        internationalprestige: Math.round(overallrating / 8),
      })),
    ),
    table(
      "leagueteamlinks",
      CLUBS.map(({ leagueid, teamid }) => ({ leagueid, teamid })),
    ),
    table("country", COUNTRIES),
    table("players", players),
    table(
      "teamplayerlinks",
      players.map((player, index) => ({
        teamid: CLUBS[(index + Math.floor(index / 8)) % CLUBS.length]?.teamid ?? 2001,
        playerid: Number(player["playerid"]),
        jerseynumber: index + 1,
        yearcontractvalidtil: 2009 + (index % 5),
        position: 33,
      })),
    ),
    flatCurves(),
  ]);
};
