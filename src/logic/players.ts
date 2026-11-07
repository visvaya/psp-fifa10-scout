// One immutable summary per player: fifa.db's players joined with their club, league, national team
// and nationality, and with a career save also the save's links, date and season stats.
import {
  careerLoans,
  careerManager,
  careerShortlist,
  effectiveRows,
  seasonStartDate,
  userFormationCodes,
} from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { ageOn, birthdateToDate, num, readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SaveFormatError } from "../data/save-format-error.ts";
import { bestPeakFields } from "./best-peak.ts";
import type { BestPeakKey } from "./best-peak.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { lazy } from "./lazy.ts";
import {
  attributeGains,
  baseOverall,
  byPositionCode,
  cappedOverall,
  careerAgeing,
  peaksByPositionCode,
  potentialDeltas,
  readCurves,
} from "./overall-rating.ts";
import type { Curves } from "./overall-rating.ts";
import { careerLinks, placementsOf, teamFields, teamsById } from "./placements.ts";
import type { Placement, TeamFields } from "./placements.ts";
import { financeOf, NO_FINANCE } from "./player-finance.ts";
import { saleFields, saleVerdictOf } from "./sale-rule.ts";
import type { SaleRefusal } from "./sale-rule.ts";
import type { Finance, FinanceInput } from "./player-finance.ts";
import { positionOf } from "./positions.ts";
import type { PositionGroup } from "./positions.ts";
import { clubStarsOf } from "./team-stars.ts";
import { marketFields, transferMarketOf } from "./transfer-market.ts";
import type { TransferMarket } from "./transfer-market.ts";

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

/**
 * Season counts from the save: league games, goals, assists and clean sheets (the game counts clean
 * sheets for goalkeepers only), each also over the domestic and European cups together (cup0..cup3). A
 * player outside the user's league has 0 in the league (docs: game-knowledge.md).
 */
export const SEASON_STAT_KEYS = [
  "appearances",
  "goals",
  "cupAppearances",
  "cupGoals",
  "assists",
  "cupAssists",
  "cleanSheets",
  "cupCleanSheets",
] as const;
type SeasonStats = { readonly [K in (typeof SEASON_STAT_KEYS)[number]]: number | null };

export interface Player extends Finance, SeasonStats, TeamFields {
  readonly id: number;
  readonly name: string;
  /** The first name as an initial ("L. Messi"), for narrow places; null for a player with one name. */
  readonly initialName: string | null;
  /** The name folded by searchKey, for text search. */
  readonly searchName: string;
  /** Position in alphabetical order of names (ties by id): Polish, or the chosen game language's. */
  readonly nameOrder: number;
  /**
   * From the generated youth pool, shown only when the save places him: in a team, the user's academy,
   * the transfer list or the game's shortlist (a scouted junior not signed yet).
   */
  readonly youth: boolean;
  /** In the user's youth academy (careers only): a junior of the user's club without a team link. */
  readonly academy: boolean;
  /** Linked to the game's free-agent team, so any club can sign him (careers only). */
  readonly freeAgent: boolean;
  readonly age: number;
  /** The calendar year of birth; contract ages count from it to the season's end. */
  readonly birthYear: number;
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
  /** Peak minus OVR: how much he still grows along the curves; career only. */
  readonly peakGain: number | null;
  /** The highest peak over all position codes, at bestPeakCode (best-peak.ts); career only. */
  readonly bestPeak: number | null;
  readonly bestPeakCode: number | null;
  /** The short name of bestPeakCode, in the game language once localized. */
  readonly bestPeakName: string | null;
  /** The best peak minus the OVR at the same position; career only. */
  readonly bestPeakGain: number | null;
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
  /** The peak OVR at each position code 0..31; empty without a career. */
  readonly peakByCode: readonly number[];
  readonly attributes: Attributes;
  /** The club's stars 0.5..5 by the game's rule, from its current squad (team-stars.ts). */
  readonly clubStars: number | null;
  readonly nationalityId: number;
  readonly nationalityName: string | null;
  /**
   * The rolling match rating (KR, from all matches, not a season average) with one decimal, as the
   * game's stats screen shows it: the save keeps it times ten (playerstats.form; 5 of 5 league ratings
   * on that screen agree).
   */
  readonly form: number | null;
  readonly morale: number | null;
  /** Days out injured, from the save. */
  readonly injuryDays: number | null;
  /** Listed for a transfer in the save's window and not sold yet. */
  readonly transferListed: boolean;
  /** Listed for a loan and not loaned yet. */
  readonly loanListed: boolean;
  /** The club he is on loan from (career only); null when he plays for his own club. */
  readonly loanedFromId: number | null;
  readonly loanedFromName: string | null;
  /** The parent club's teams.overallrating; null when he is not on loan or the club has no team row. */
  readonly loanedFromRating: number | null;
  /**
   * In a career, whether his club may sell him to the user at all (sale-rule.ts); null without a club or
   * career, or in the user's club.
   */
  readonly clubWillSell: boolean | null;
  /** Why the game refuses any offer for him; null when it does not, or when clubWillSell is null. */
  readonly saleRefusal: SaleRefusal | null;
  /** On the user's shortlist in the game (the save's career_shortlist). */
  readonly shortlisted: boolean;
}

interface Context {
  readonly referenceDate: Date;
  readonly placements: ReadonlyMap<number, Placement>;
  readonly countries: ReadonlyMap<number, string>;
  readonly stats: ReadonlyMap<number, EaDbRow>;
  readonly market: TransferMarket;
  readonly teams: ReturnType<typeof teamsById>;
  readonly shortlist: ReadonlySet<number>;
  readonly academy: ReadonlySet<number>;
  /** Career only. */
  readonly saleVerdict: ((playerId: number) => SaleRefusal | "sells" | null) | null;
  readonly freeAgents: ReadonlySet<number>;
  readonly rate: (row: EaDbRow) => Rating;
  /** The user's starting eleven, which a tie for the best peak goes by; empty without a save. */
  readonly formationCodes: readonly number[];
  /** Career only. */
  readonly finance: ((input: FinanceInput) => Finance) | null;
}

/** A player's attributes as the list shows them and his OVR at any position code. */
interface Rating {
  readonly attributes: Attributes;
  readonly potential: number;
  readonly overallAt: (positionCode: number, yearsAhead?: number) => number;
  /** The peak OVR at each position code; empty without a save, as nothing ages. */
  readonly peakByCode: readonly number[];
}

/** Polish alphabetical order: the default of every text sort. Made on first use (lazy.ts). */
export const nameCollator = lazy(() => new Intl.Collator("pl"));

/** Text without case and diacritics (ł included, which has no decomposition), for search. */
export const searchKey = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/ł/giu, "l").toLowerCase();

/** A column of the save's stats row; null without the row or the column. */
const statOf = (stats: EaDbRow | undefined, key: string): number | null =>
  stats?.[key] === undefined ? null : num(stats, key);

/** A stat summed over the four cup columns (cup0..cup3); a column the row lacks counts 0. */
const cupTotal = (stats: EaDbRow | undefined, key: string): number | null =>
  stats === undefined
    ? null
    : [0, 1, 2, 3].reduce((total, cup) => total + Number(stats[`${key}cup${String(cup)}`] ?? 0), 0);

const seasonStats = (stats: EaDbRow | undefined): SeasonStats => ({
  appearances: statOf(stats, "appearances"),
  goals: statOf(stats, "goals"),
  cupAppearances: cupTotal(stats, "appearances"),
  cupGoals: cupTotal(stats, "goals"),
  assists: statOf(stats, "assists"),
  cupAssists: cupTotal(stats, "assists"),
  cleanSheets: statOf(stats, "cleansheets"),
  cupCleanSheets: cupTotal(stats, "cleansheets"),
});

/** The rolling match rating, stored times ten. */
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

type Summary = Omit<Player, "nameOrder" | "clubStars">;

const summary = (row: EaDbRow, context: Context): Summary => {
  const id = num(row, "playerid");
  const position = positionOf(num(row, "preferredposition1"));
  const stats = context.stats.get(id);
  const nationalityId = num(row, "nationality");
  const [firstName, surname] = [String(row["firstname"]).trim(), String(row["surname"]).trim()];
  const name = `${firstName} ${surname}`.trim();
  const { attributes, potential, overallAt, peakByCode } = context.rate(row);
  const age = ageOn(birthdateToDate(num(row, "birthdate")), context.referenceDate);
  const { club } = context.placements.get(id) ?? {};
  const money = club && { link: club.link, prestige: club.team.prestige };
  const overallByCode = byPositionCode(overallAt);
  const rate = (code: number): number => overallByCode[code] ?? 0;
  const overall = rate(num(row, "preferredposition1"));
  const peak = peakByCode[num(row, "preferredposition1")] ?? null;
  const player: Omit<Summary, BestPeakKey> = {
    id,
    name,
    initialName: firstName === "" || surname === "" ? null : `${firstName.charAt(0)}. ${surname}`,
    searchName: searchKey(name),
    youth: id >= SCOUT_CONFIG.youthPlayerIdStart,
    academy: context.academy.has(id),
    freeAgent: context.freeAgents.has(id),
    age,
    birthYear: birthdateToDate(num(row, "birthdate")).getUTCFullYear(),
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
    peakGain: peak === null ? null : peak - overall,
    ...profileFields(row),
    overallByCode,
    peakByCode,
    attributes,
    ...teamFields(context.placements.get(id) ?? {}, context.market.loanedFrom.has(id)),
    nationalityId,
    nationalityName: context.countries.get(nationalityId) ?? null,
    form: ratingOf(stats),
    morale: statOf(stats, "morale"),
    ...seasonStats(stats),
    injuryDays: statOf(stats, "injurydaysout"),
    ...marketFields(context.market, context.teams, id),
    ...saleFields(context.saleVerdict?.(id) ?? null),
    shortlisted: context.shortlist.has(id),
    ...(context.finance?.({ row, age, club: money, overallAt }) ?? NO_FINANCE),
  };
  return { ...player, ...bestPeakFields(player, context.formationCodes) };
};

/** Each summary frozen with its nameOrder; the order is computed once so sorts stay numeric. */
export const withNameOrder = (
  players: readonly Omit<Player, "nameOrder">[],
  collator: Intl.Collator = nameCollator(),
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
const rater = (db: EaDb, save: CareerSave | undefined, read?: Curves): Context["rate"] => {
  if (save === undefined)
    return (row) => {
      const attributes = attributesOf(row);
      return {
        attributes,
        potential: num(row, "potential"),
        overallAt: (code) => baseOverall(attributes, code),
        peakByCode: [],
      };
    };
  const curves = read ?? readCurves(db);
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
    const ageing = careerAgeing(input, date, curves);
    const aged = ageing.attributesIn(0);
    const attributes = attributesOf(
      Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, aged(name)])),
    );
    const overallAt = (code: number, yearsAhead = 0): number =>
      cappedOverall(
        yearsAhead === 0 ? (name) => attributes[name] : ageing.attributesIn(yearsAhead),
        code,
        potential,
      );
    return {
      attributes,
      potential,
      overallAt,
      peakByCode: peaksByPositionCode(ageing, potential),
    };
  };
};

/**
 * Every player with his club and nationality; youth-pool players only when a team link, or the
 * save's youth academy, transfer list or shortlist, places them. With a save, links and stats come from it and ages are taken on its last game date.
 * `curves`: the database's curves when the caller has read them already.
 */
export const buildPlayers = (db: EaDb, save?: CareerSave, curves?: Curves): readonly Player[] => {
  const links =
    save === undefined
      ? readTable(db, "teamplayerlinks")
      : effectiveRows(db, save, "teamplayerlinks");
  const stats = save === undefined ? [] : effectiveRows(db, save, "playerstats");
  const transferList = save === undefined ? [] : effectiveRows(db, save, "career_transfer_list");
  const teams = teamsById(db, save);
  const placements = placementsOf(save === undefined ? links : careerLinks(db, save), teams);
  const academy = save === undefined ? [] : effectiveRows(db, save, "career_youth_accademy");
  // Without a career there is no shortlist.
  const shortlist = save === undefined ? [] : careerShortlist(db, save);
  const market = transferMarketOf(transferList, save === undefined ? [] : careerLoans(db, save));
  const context: Context = {
    referenceDate:
      save === undefined
        ? new Date(SCOUT_CONFIG.referenceDateIso)
        : careerManager(db, save).lastGameDate,
    placements,
    countries: new Map(
      readTable(db, "country").map((row) => [num(row, "countryid"), String(row["countryname"])]),
    ),
    stats: new Map(stats.map((row) => [num(row, "playerid"), row])),
    market,
    teams,
    shortlist: new Set(shortlist.map((row) => num(row, "playerid"))),
    academy: new Set(academy.map((row) => num(row, "playerid"))),
    freeAgents: new Set(
      links
        .filter((row) => num(row, "teamid") === SCOUT_CONFIG.freeAgentTeamId)
        .map((row) => num(row, "playerid")),
    ),
    rate: rater(db, save, curves),
    formationCodes: save === undefined ? [] : userFormationCodes(db, save),
    finance: save === undefined ? null : financeOf(db, save, market.loanedFrom),
    saleVerdict: save === undefined ? null : saleVerdictOf(db, save, placements),
  };
  // The game keeps generated players out of the leagues until it places them (overall-rating.md, F2).
  const placed = new Set(
    [...links, ...academy, ...transferList, ...shortlist].map((row) => num(row, "playerid")),
  );
  const summaries = readTable(db, "players")
    .filter(
      (row) =>
        num(row, "playerid") < SCOUT_CONFIG.youthPlayerIdStart || placed.has(num(row, "playerid")),
    )
    .map((row) => summary(row, context));
  // A club's stars need its whole squad's OVRs; the summaries are this build's own, so they take the
  // stars in place before withNameOrder freezes its copies.
  const starsOf = clubStarsOf(summaries, links);
  return withNameOrder(
    summaries.map((player) => Object.assign(player, { clubStars: starsOf(player.clubId) })),
  );
};
