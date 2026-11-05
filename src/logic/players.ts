// One immutable summary per player: fifa.db's players joined with their club, league, national team
// and nationality, and with a career save also the save's links, date and season stats.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { ageOn, birthdateToDate, readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { SCOUT_CONFIG } from "./config.ts";
import {
  attributeGains,
  baseOverall,
  byPositionCode,
  cappedOverall,
  careerAttributes,
  peakOverall,
  potentialDeltas,
  readCurves,
} from "./overall-rating.ts";
import { placementsOf, teamFields, teamsById } from "./placements.ts";
import type { Placement } from "./placements.ts";
import { financeOf, NO_FINANCE } from "./player-finance.ts";
import type { Finance, FinanceInput } from "./player-finance.ts";
import { positionOf } from "./positions.ts";
import type { PositionGroup } from "./positions.ts";

// Column names, alike by nature. jscpd:ignore-start
/** The attribute columns of `players`, in table order (potential is a separate field). */
export const ATTRIBUTE_NAMES = [
  "acceleration",
  "aggression",
  "ballcontrol",
  "crossing",
  "dribbling",
  "finishing",
  "freekicks",
  "heading",
  "longpassing",
  "longshotaccuracy",
  "marking",
  "playercomposure",
  "positioning",
  "reactions",
  "shortpassing",
  "shotpower",
  "sprintspeed",
  "stamina",
  "strength",
  "tackling",
  "tacticalawareness",
  "gkdiving",
  "gkpositioning",
  "handling",
  "reflexes",
] as const;

export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

/** The yes/no columns of `players` (0 or 1), in table order. */
export const TRAIT_NAMES = [
  "injuryprone",
  "adaptability",
  "ambition",
  "comesforcrosses",
  "diver",
  "divesintotackles",
  "earlycrosser",
  "fansfavourite",
  "flexibility",
  "highclubidentification",
  "hightrainingworkrate",
  "holdsup",
  "inflexible",
  "latecrosser",
  "leadership",
  "longshottaker",
  "longthrows",
  "lowclubidentification",
  "lowconcentration",
  "lowtrainingworkrate",
  "mediadarling",
  "onetimepasser",
  "playmaker",
  "puncher",
  "pushesupforcorners",
  "rushesoutofgoal",
  "scandalprone",
  "selfish",
  "staysongoalline",
  "technicaldribbler",
] as const;

// jscpd:ignore-end
export type TraitName = (typeof TRAIT_NAMES)[number];
export type Attributes = Readonly<Record<AttributeName, number>>;

export const isAttributeName = (name: string): name is AttributeName =>
  (ATTRIBUTE_NAMES as readonly string[]).includes(name);

const isAttributes = (record: Readonly<Record<string, number>>): record is Attributes =>
  ATTRIBUTE_NAMES.every((name) => Number.isFinite(record[name]));

/** The attribute columns of a players row; throws SaveFormatError when one is missing. */
export const attributesOf = (row: EaDbRow): Attributes => {
  const record = Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, Number(row[name])]));
  if (!isAttributes(record)) throw new SaveFormatError("Database players lack attribute columns");
  return Object.freeze(record);
};

export interface Player extends Finance {
  readonly id: number;
  readonly name: string;
  /** The first name as an initial ("L. Messi"), for narrow places; null for a player with one name. */
  readonly initialName: string | null;
  /** The name folded by searchKey, for text search. */
  readonly searchName: string;
  /** Position in alphabetical order of names (ties by id): Polish, or the chosen game language's. */
  readonly nameOrder: number;
  /** From the generated youth pool (shown only when a save links the player to a team). */
  readonly youth: boolean;
  /** Linked to the game's free-agent team, so any club can sign him (careers only). */
  readonly freeAgent: boolean;
  readonly age: number;
  readonly positionCode: number;
  readonly positionName: string;
  readonly positionGroup: PositionGroup;
  readonly preferredFoot: "left" | "right";
  /** Centimetres. */
  readonly height: number;
  /** Kilograms. */
  readonly weight: number;
  /** With a save, the career potential: the database's plus the save's potential delta. */
  readonly potential: number;
  /** The highest OVR the development curves project at the preferred position; career only. */
  readonly peak: number | null;
  /** OVR at the preferred position: aged to the season's first match day with a save, from fifa.db without. */
  readonly overall: number;
  /** Potential minus OVR. */
  readonly growth: number;
  /** bodysizecode, 1..3; the game does not name the codes. */
  readonly bodyType: number;
  /** 1..5 stars (weakfootability 0..4). */
  readonly weakFoot: number;
  /** 1..5 stars. */
  readonly internationalReputation: number;
  /** 1..5. */
  readonly learningSpeed: number;
  readonly retirementAge: number;
  /** developmenttypecode and developmentstylecode, the codes of the growth curves. */
  readonly developmentType: number;
  readonly developmentStyle: number;
  /** The yes/no columns set for him, in TRAIT_NAMES order. */
  readonly traits: readonly TraitName[];
  /** OVR at each position code 0..31, rated the same way. */
  readonly overallByCode: readonly number[];
  readonly attributes: Attributes;
  readonly clubId: number | null;
  readonly clubName: string | null;
  /** The club's teams.overallrating. */
  readonly clubRating: number | null;
  readonly leagueId: number | null;
  readonly leagueName: string | null;
  readonly contractEndYear: number | null;
  readonly jerseyNumber: number | null;
  readonly nationalTeamId: number | null;
  readonly nationalTeamName: string | null;
  readonly nationalityId: number;
  readonly nationalityName: string | null;
  /**
   * The average match rating (KR) with one decimal, as the game's stats screen shows it: the save keeps
   * it times ten (playerstats.form; 5 of 5 league ratings on that screen agree).
   */
  readonly form: number | null;
  readonly morale: number | null;
  readonly goals: number | null;
  readonly appearances: number | null;
  /** Days out injured, from the save. */
  readonly injuryDays: number | null;
  /** On the save's transfer list. */
  readonly transferListed: boolean;
  /** On the user's shortlist in the game (the save's career_shortlist). */
  readonly shortlisted: boolean;
}

interface Context {
  readonly referenceDate: Date;
  readonly placements: ReadonlyMap<number, Placement>;
  readonly countries: ReadonlyMap<number, string>;
  readonly stats: ReadonlyMap<number, EaDbRow>;
  readonly transferList: ReadonlySet<number>;
  readonly shortlist: ReadonlySet<number>;
  readonly freeAgents: ReadonlySet<number>;
  readonly rate: (row: EaDbRow) => Rating;
  /** Career only. */
  readonly finance: ((input: FinanceInput) => Finance) | null;
}

/** A player's attributes as the list shows them and his OVR at any position code. */
interface Rating {
  readonly attributes: Attributes;
  readonly potential: number;
  readonly overallAt: (positionCode: number, yearsAhead?: number) => number;
  /** Career only: without a save nothing ages. */
  readonly peak: number | null;
}

const num = (row: EaDbRow, key: string): number => Number(row[key]);

/** Polish alphabetical order: the default of every text sort. */
export const nameCollator = new Intl.Collator("pl");

/** Text without case and diacritics (ł included, which has no decomposition), for search. */
export const searchKey = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/ł/giu, "l").toLowerCase();

/**
 * The game's shortlist in a career: the save's rows, else the database's (fifa.db's is empty; a database
 * without the table, as in tests, has none). Without a career there is no shortlist.
 */
const shortlistOf = (db: EaDb, save: CareerSave | undefined): readonly EaDbRow[] => {
  if (save === undefined) return [];
  return (
    save.get("career_shortlist") ??
    (db.tables.has("career_shortlist") ? readTable(db, "career_shortlist") : [])
  );
};

const statOf = (stats: EaDbRow | undefined, key: string): number | null =>
  stats === undefined ? null : num(stats, key);

/** The average match rating, stored times ten. */
const ratingOf = (stats: EaDbRow | undefined): number | null => {
  const tenths = statOf(stats, "form");
  return tenths === null ? null : tenths / 10;
};

const profileFields = (row: EaDbRow) => ({
  bodyType: num(row, "bodysizecode"),
  weakFoot: num(row, "weakfootability") + 1,
  internationalReputation: num(row, "internationalreputation"),
  learningSpeed: num(row, "learningspeed"),
  retirementAge: num(row, "retirementage"),
  developmentType: num(row, "developmenttypecode"),
  developmentStyle: num(row, "developmentstylecode"),
  traits: TRAIT_NAMES.filter((trait) => num(row, trait) === 1),
});

const summary = (row: EaDbRow, context: Context): Omit<Player, "nameOrder"> => {
  const id = num(row, "playerid");
  const position = positionOf(num(row, "preferredposition1"));
  const stats = context.stats.get(id);
  const nationalityId = num(row, "nationality");
  const [firstName, surname] = [String(row["firstname"]).trim(), String(row["surname"]).trim()];
  const name = `${firstName} ${surname}`.trim();
  const { attributes, potential, overallAt, peak } = context.rate(row);
  const age = ageOn(birthdateToDate(num(row, "birthdate")), context.referenceDate);
  const { club } = context.placements.get(id) ?? {};
  const money = club && { link: club.link, prestige: club.team.prestige };
  const overallByCode = byPositionCode(overallAt);
  const rate = (code: number): number => overallByCode[code] ?? 0;
  const overall = rate(num(row, "preferredposition1"));
  return {
    id,
    name,
    initialName: firstName === "" || surname === "" ? null : `${firstName.charAt(0)}. ${surname}`,
    searchName: searchKey(name),
    youth: id >= SCOUT_CONFIG.youthPlayerIdStart,
    freeAgent: context.freeAgents.has(id),
    age,
    positionCode: num(row, "preferredposition1"),
    positionName: position.name,
    positionGroup: position.group,
    preferredFoot: num(row, "preferredfoot") === 1 ? "left" : "right",
    height: num(row, "height"),
    weight: num(row, "weight"),
    potential,
    peak,
    overall,
    growth: potential - overall,
    ...profileFields(row),
    overallByCode,
    attributes,
    ...teamFields(context.placements.get(id) ?? {}),
    nationalityId,
    nationalityName: context.countries.get(nationalityId) ?? null,
    form: ratingOf(stats),
    morale: statOf(stats, "morale"),
    goals: statOf(stats, "goals"),
    appearances: statOf(stats, "appearances"),
    injuryDays: statOf(stats, "injurydaysout"),
    transferListed: context.transferList.has(id),
    shortlisted: context.shortlist.has(id),
    ...(context.finance?.({ row, age, club: money, overallAt }) ?? NO_FINANCE),
  };
};

/** Each summary frozen with its nameOrder; the order is computed once so sorts stay numeric. */
export const withNameOrder = (
  players: readonly Omit<Player, "nameOrder">[],
  collator: Intl.Collator = nameCollator,
): readonly Player[] => {
  const order = new Map(
    players
      .toSorted((a, b) => collator.compare(a.name, b.name) || a.id - b.id)
      .map((player, index) => [player, index]),
  );
  return Object.freeze(
    players.map((player) => Object.freeze({ ...player, nameOrder: order.get(player) ?? 0 })),
  );
};

/**
 * Attributes and OVR from fifa.db without a save; with one, aged to the season's first match day, as
 * the game shows them in the career (overall-rating.md).
 */
const rater = (db: EaDb, save: CareerSave | undefined): Context["rate"] => {
  if (save === undefined)
    return (row) => {
      const attributes = attributesOf(row);
      return {
        attributes,
        potential: num(row, "potential"),
        overallAt: (code) => baseOverall(attributes, code),
        peak: null,
      };
    };
  const curves = readCurves(db);
  const deltas = potentialDeltas(db, save);
  const gains = attributeGains(db, save);
  const date = seasonStartDate(db, save);
  return (row) => {
    const potential = num(row, "potential") + (deltas.get(num(row, "playerid")) ?? 0);
    const gain = gains.get(num(row, "playerid"));
    const input = {
      // The gains count before ageing, as the database attributes they add to.
      attributes:
        gain === undefined
          ? attributesOf(row)
          : attributesOf(
              Object.fromEntries(
                ATTRIBUTE_NAMES.map((name) => [name, num(row, name) + gain(name)]),
              ),
            ),
      potential,
      birthdate: birthdateToDate(num(row, "birthdate")),
      developmentTypeCode: num(row, "developmenttypecode"),
      developmentStyleCode: num(row, "developmentstylecode"),
    };
    const aged = careerAttributes(input, date, curves);
    const attributes = attributesOf(
      Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, aged(name)])),
    );
    const overallAt = (code: number, yearsAhead = 0): number =>
      cappedOverall(
        yearsAhead === 0
          ? (name) => attributes[name]
          : careerAttributes(input, date, curves, yearsAhead),
        code,
        potential,
      );
    return {
      attributes,
      potential,
      overallAt,
      peak: peakOverall(overallAt, num(row, "preferredposition1")),
    };
  };
};

/**
 * Every player with his club and nationality; youth-pool players only when a team link, or the
 * save's youth academy or transfer list, places them. With a save, links and stats come from it and ages are taken on its last game date.
 */
export const buildPlayers = (db: EaDb, save?: CareerSave): readonly Player[] => {
  const links =
    save === undefined
      ? readTable(db, "teamplayerlinks")
      : effectiveRows(db, save, "teamplayerlinks");
  const stats = save === undefined ? [] : effectiveRows(db, save, "playerstats");
  const transferList = save === undefined ? [] : effectiveRows(db, save, "career_transfer_list");
  const context: Context = {
    referenceDate:
      save === undefined
        ? new Date(SCOUT_CONFIG.referenceDateIso)
        : careerManager(db, save).lastGameDate,
    placements: placementsOf(links, teamsById(db, save)),
    countries: new Map(
      readTable(db, "country").map((row) => [num(row, "countryid"), String(row["countryname"])]),
    ),
    stats: new Map(stats.map((row) => [num(row, "playerid"), row])),
    transferList: new Set(transferList.map((row) => num(row, "playerid"))),
    shortlist: new Set(shortlistOf(db, save).map((row) => num(row, "playerid"))),
    freeAgents: new Set(
      links
        .filter((row) => num(row, "teamid") === SCOUT_CONFIG.freeAgentTeamId)
        .map((row) => num(row, "playerid")),
    ),
    rate: rater(db, save),
    finance: save === undefined ? null : financeOf(db, save),
  };
  // The game keeps generated players out of the leagues until it places them (overall-rating.md, F2).
  const placed = new Set(
    [
      ...links,
      ...(save === undefined
        ? []
        : [...effectiveRows(db, save, "career_youth_accademy"), ...transferList]),
    ].map((row) => num(row, "playerid")),
  );
  return withNameOrder(
    readTable(db, "players")
      .filter(
        (row) =>
          num(row, "playerid") < SCOUT_CONFIG.youthPlayerIdStart ||
          placed.has(num(row, "playerid")),
      )
      .map((row) => summary(row, context)),
  );
};
