// A fifa.db for the start page's screenshots: invented clubs, leagues, countries and players, with attributes
// that follow each position, drawn from a seeded generator (the same bytes on every run), invented
// development curves and a career in the user's club, so a plain save shows the peak OVR. It holds no real
// player, club or curve. The browser tests keep their own, hand-made database (src/logic/test-support/scout-db.ts).
import { buildEaDb } from "../src/data/test-support/synthetic-ea-db.ts";
import { CURVE_COLUMNS } from "../src/logic/overall-rating.ts";
import { ATTRIBUTE_NAMES } from "../src/logic/attributes.ts";
import type { AttributeName } from "../src/logic/attributes.ts";
import {
  daysSince1582,
  formationTables,
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

/** The career's user club, and its last game: 2009-08-08, days since 1582-10-14 times 1024. */
const USER_CLUB_ID = 2001;
const LAST_GAME_NUMBER = 155_892 * 1024;

/** The development styles the players draw from (1 Normal, 2 Good); the types run 1..3, early to late. */
const STYLES = [1, 2] as const;
const TYPES = [1, 2, 3] as const;
const CURVE_AGE_FIRST = 15;
const CURVE_TOP = 100;
const CURVE_FLOOR = 30;

/**
 * An invented curve shaped like the game's: it rises to its top at `peakAge`, stays there `plateauYears`,
 * then falls by `fallPerYear`, a value for every curve column (ages 15..45).
 */
const curveRow = (
  id: number,
  shape: { peakAge: number; risePerYear: number; plateauYears: number; fallPerYear: number },
) => ({
  id,
  ...Object.fromEntries(
    CURVE_COLUMNS.map((column, index) => {
      const age = CURVE_AGE_FIRST + index;
      const fallYears = age - shape.peakAge - shape.plateauYears;
      const value =
        age < shape.peakAge
          ? CURVE_TOP - (shape.peakAge - age) * shape.risePerYear
          : CURVE_TOP - Math.max(0, fallYears) * shape.fallPerYear;
      return [column, Math.max(CURVE_FLOOR, value)];
    }),
  ),
});

/**
 * The curves as the game numbers them: the skill curve 3 * style + type - 4 peaks later for a later type
 * and rises faster for a better style; the physical curve 14 + type peaks earlier and falls faster.
 */
const CURVES = [
  ...STYLES.flatMap((style) =>
    TYPES.map((type) =>
      curveRow(3 * style + type - 4, {
        peakAge: 24 + 2 * type,
        risePerYear: 3 + style,
        plateauYears: 2,
        fallPerYear: 2,
      }),
    ),
  ),
  ...TYPES.map((type) =>
    curveRow(14 + type, {
      peakAge: 22 + 2 * type,
      risePerYear: 3,
      plateauYears: 1,
      fallPerYear: 4,
    }),
  ),
];

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
    // Drawn last, so the attributes stay those of the earlier sample.
    developmenttypecode: TYPES[Math.floor(random() * TYPES.length)] ?? 2,
    developmentstylecode: STYLES[Math.floor(random() * STYLES.length)] ?? 1,
  });
};

const empty = (name: string) => ({ name, u32: ["playerid"], rows: [] });

/** The sample database: the tables the app needs to list players, and a career a plain save reads. */
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
    table("curves", CURVES),
    ...formationTables(USER_CLUB_ID),
    table("team_manager", [
      {
        team_id: USER_CLUB_ID,
        firstname: "Anna",
        surname: "Menedżer",
        last_game_number: LAST_GAME_NUMBER,
        currency: 0,
        prestige: 0,
        upgrade_fin: 0,
      },
    ]),
    ...[
      "playerstats",
      "career_youth_accademy",
      "career_transfer_list",
      "career_shortlist",
      "career_players_grown_attributes",
      "career_extra_user_team_info",
    ].map(empty),
  ]);
};
