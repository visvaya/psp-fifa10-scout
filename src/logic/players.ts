// One immutable summary per player: fifa.db's players joined with their club, league, national team
// and nationality, and with a career save also the save's links, date and season stats.
import {
  careerList,
  careerManager,
  effectiveRows,
  seasonStartDate,
  userFormationCodes,
} from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { ageOn, birthdateToDate, num, readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { ATTRIBUTE_NAMES, attributesOf, TRAIT_NAMES } from "./attributes.ts";
import type { Attributes, TraitName } from "./attributes.ts";
import { bestPeakFields } from "./best-peak.ts";
import type { BestPeakKey } from "./best-peak.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { dueLevelUp, NO_LEVEL_UP, squadLevelUp } from "./level-up.ts";
import type { LevelUpFields } from "./level-up.ts";
import { initialNameOf, nameCollator, searchKey } from "./player-names.ts";
import { composedPortraitOf } from "./portraits.ts";
import {
  attributeGains,
  baseOverall,
  byPositionCode,
  cappedOverall,
  careerAgeing,
  careerPotential,
  overallsByAge,
  peaksByPositionCode,
  potentialDeltas,
  signingDelta,
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
import { lastSeasonAge, retiresAfterSeason } from "./retirement.ts";
import { NO_ROLES, playerRoles } from "./roles.ts";
import type { RoleFields, RoleInput, RoleKey } from "./roles.ts";
import { seasonStats, statOf } from "./season-stats.ts";
import type { SeasonStats } from "./season-stats.ts";
import { clubStarsOf } from "./team-stars.ts";
import { marketFields, transferMarketOf } from "./transfer-market.ts";
import type { TransferMarket } from "./transfer-market.ts";

export interface Player extends Finance, SeasonStats, TeamFields, RoleFields, LevelUpFields {
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
  /**
   * Years to the end of the contract as the game counts them: its end year minus the year the season
   * started; 0 runs out this season (a free transfer). Null without a contract.
   */
  readonly contractYearsLeft: number | null;
  readonly age: number;
  /** His age on the season's first match day, his place on his curves all season; else `age`. */
  readonly seasonAge: number;
  /** His season age in the season after which he retires (retirement.ts), on the charts' ages. */
  readonly lastSeasonAge: number;
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
  /** He retires when this season ends (retirement.ts). */
  readonly retiring: boolean;
  /** developmenttypecode and developmentstylecode, the codes of the growth curves. */
  readonly developmentType: number;
  readonly developmentStyle: number;
  /** The yes/no columns set for him, in TRAIT_NAMES order. */
  readonly traits: readonly TraitName[];
  /** OVR at each position code 0..31, rated the same way. */
  readonly overallByCode: readonly number[];
  /** The peak OVR at each position code 0..31; empty without a career. */
  readonly peakByCode: readonly number[];
  /**
   * OVR at the preferred position at each age from seasonAge to 45, the curves' last: index 0 is this
   * season. Empty without a career.
   */
  readonly overallByAge: readonly number[];
  readonly attributes: Attributes;
  /** The club's stars 0.5..5 by the game's rule, from its current squad (team-stars.ts). */
  readonly clubStars: number | null;
  readonly nationalityId: number;
  readonly nationalityName: string | null;
  /** The game's composed portrait of his face (portraits.ts); his real one, if any, follows from id. */
  readonly composedPortrait: string;
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
  /** The year the season started, from which the game counts contract years. */
  readonly seasonYear: number;
  readonly placements: ReadonlyMap<number, Placement>;
  readonly countries: ReadonlyMap<number, string>;
  readonly stats: ReadonlyMap<number, EaDbRow>;
  readonly market: TransferMarket;
  readonly teams: ReturnType<typeof teamsById>;
  readonly shortlist: ReadonlySet<number>;
  readonly academy: ReadonlySet<number>;
  /** Career only. */
  readonly saleVerdict: ((playerId: number) => SaleRefusal | "sells" | null) | null;
  /** The experience bar of the user's squad (level-up.ts); none without a save or outside the squad. */
  readonly levelUp: (playerId: number) => LevelUpFields;
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
  /** OVR at the preferred position from his age this season to 45; empty without a save. */
  readonly overallByAge: readonly number[];
  /** His age on the career date the ratings are aged to; absent without a save. */
  readonly seasonAge?: number;
}

/** The years from `start` to `end`, as the game counts contract years; null without an end. */
const yearsAfter = (end: number | null, start: number): number | null =>
  end === null ? null : end - start;

/** The rolling match rating, stored times ten. */
const ratingOf = (stats: EaDbRow | undefined): number | null => {
  const tenths = statOf(stats, "form");
  return tenths === null ? null : tenths / 10;
};

const profileFields = (row: EaDbRow, seasonYear: number, seasonAge: number) => ({
  bodyType: num(row, "bodysizecode"),
  weakFoot: num(row, "weakfootability") + 1,
  internationalReputation: num(row, "internationalreputation"),
  learningSpeed: num(row, "learningspeed"),
  retirementAge: num(row, "retirementage"),
  retiring: retiresAfterSeason(
    birthdateToDate(num(row, "birthdate")),
    num(row, "retirementage"),
    seasonYear,
  ),
  seasonAge,
  lastSeasonAge: lastSeasonAge(
    birthdateToDate(num(row, "birthdate")),
    num(row, "retirementage"),
    seasonYear,
    seasonAge,
  ),
  developmentType: num(row, "developmenttypecode"),
  developmentStyle: num(row, "developmentstylecode"),
  traits: TRAIT_NAMES.filter((trait) => num(row, trait) === 1),
});

type Summary = Omit<Player, "nameOrder" | "clubStars" | RoleKey>;

const summary = (row: EaDbRow, context: Context): Summary => {
  const id = num(row, "playerid");
  const position = positionOf(num(row, "preferredposition1"));
  const stats = context.stats.get(id);
  const nationalityId = num(row, "nationality");
  const [firstName, surname] = [String(row["firstname"]).trim(), String(row["surname"]).trim()];
  const name = `${firstName} ${surname}`.trim();
  const { attributes, potential, overallAt, peakByCode, overallByAge, seasonAge } =
    context.rate(row);
  const age = ageOn(birthdateToDate(num(row, "birthdate")), context.referenceDate);
  const { club } = context.placements.get(id) ?? {};
  const money = club && { link: club.link, prestige: club.team.prestige };
  const overallByCode = byPositionCode(overallAt);
  const rate = (code: number): number => overallByCode[code] ?? 0;
  const overall = rate(num(row, "preferredposition1"));
  const peak = peakByCode[num(row, "preferredposition1")] ?? null;
  const team = teamFields(context.placements.get(id) ?? {}, context.market.loanedFrom.has(id));
  const player: Omit<Summary, BestPeakKey> = {
    id,
    name,
    initialName: initialNameOf(firstName, surname),
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
    ...profileFields(row, context.seasonYear, seasonAge ?? age),
    overallByCode,
    peakByCode,
    overallByAge,
    attributes,
    ...team,
    contractYearsLeft: yearsAfter(team.contractEndYear, context.seasonYear),
    nationalityId,
    nationalityName: context.countries.get(nationalityId) ?? null,
    composedPortrait: composedPortraitOf(row),
    form: ratingOf(stats),
    morale: statOf(stats, "morale"),
    ...seasonStats(stats),
    injuryDays: statOf(stats, "injurydaysout"),
    ...dueLevelUp(context.levelUp(id), overall, potential),
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
 * A player's potential_delta: the save's for the user's squad; outside it none, or after signing the one
 * the game gives then.
 */
const deltaOf =
  (deltas: ReadonlyMap<number, number>, afterSigning: boolean) =>
  (row: EaDbRow): number =>
    deltas.get(num(row, "playerid")) ?? (afterSigning ? signingDelta(row) : 0);

/**
 * Attributes and OVR from fifa.db without a save; with one, aged to the season's first match day, as
 * the game shows them in the career (overall-rating.md).
 */
const rater = (
  db: EaDb,
  save: CareerSave | undefined,
  read: Curves | undefined,
  afterSigning: boolean,
): Context["rate"] => {
  if (save === undefined)
    return (row) => {
      const attributes = attributesOf(row);
      return {
        attributes,
        potential: num(row, "potential"),
        overallAt: (code) => baseOverall(attributes, code),
        peakByCode: [],
        overallByAge: [],
      };
    };
  const curves = read ?? readCurves(db);
  const delta = deltaOf(potentialDeltas(db, save), afterSigning);
  const gains = attributeGains(db, save);
  const date = seasonStartDate(db, save);
  return (row) => {
    const potential = careerPotential(num(row, "potential"), delta(row));
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
      overallByAge: overallsByAge(ageing, num(row, "preferredposition1"), potential),
      seasonAge: ageing.age,
    };
  };
};

/**
 * The date ages are taken on (the last game, else the season's start) and the year the season started;
 * without a save, the database's own start.
 */
const datesOf = (db: EaDb, save: CareerSave | undefined) => {
  if (save === undefined) {
    const start = new Date(SCOUT_CONFIG.referenceDateIso);
    return { referenceDate: start, seasonYear: start.getUTCFullYear() };
  }
  const seasonStart = seasonStartDate(db, save);
  return {
    referenceDate: careerManager(db, save).lastGameDate ?? seasonStart,
    seasonYear: seasonStart.getUTCFullYear(),
  };
};

/**
 * Each player's role, state and targets (roles.ts) from the user club's team sheet; none without a career
 * or a formation, so the links need no positions then.
 */
const rolesIn = (
  db: EaDb,
  save: CareerSave | undefined,
  links: readonly EaDbRow[],
  players: readonly RoleInput[],
): ((player: RoleInput) => RoleFields) => {
  const formationCodes = save === undefined ? [] : userFormationCodes(db, save);
  if (save === undefined || formationCodes.length === 0) return () => NO_ROLES;
  const { teamId } = careerManager(db, save);
  const sheet = new Map(
    links
      .filter((link) => num(link, "teamid") === teamId)
      .map((link) => [num(link, "playerid"), num(link, "position")]),
  );
  return playerRoles(players, sheet, formationCodes);
};

/** The parts of the context only a career save has: none without one. */
const careerParts = (
  db: EaDb,
  save: CareerSave | undefined,
  placements: ReadonlyMap<number, Placement>,
): Pick<Context, "saleVerdict" | "levelUp"> =>
  save === undefined
    ? { saleVerdict: null, levelUp: () => NO_LEVEL_UP }
    : { saleVerdict: saleVerdictOf(db, save, placements), levelUp: squadLevelUp(db, save) };

/**
 * Every player with his club and nationality; youth-pool players only when a team link, or the
 * save's youth academy, transfer list or shortlist, places them. With a save, links and stats come from it and ages are taken on its last game date.
 * `curves`: the database's curves when the caller has read them already. `afterSigning`: players
 * outside the user's squad as the game rates them once signed, their potential up by signingDelta.
 */
export const buildPlayers = (
  db: EaDb,
  save?: CareerSave,
  curves?: Curves,
  afterSigning = false,
): readonly Player[] => {
  const links =
    save === undefined
      ? readTable(db, "teamplayerlinks")
      : effectiveRows(db, save, "teamplayerlinks");
  const stats = save === undefined ? [] : effectiveRows(db, save, "playerstats");
  const transferList = save === undefined ? [] : effectiveRows(db, save, "career_transfer_list");
  const teams = teamsById(db, save);
  const placements = placementsOf(save === undefined ? links : careerLinks(db, save), teams);
  const academy = save === undefined ? [] : effectiveRows(db, save, "career_youth_accademy");
  const shortlist = careerList(db, save, "career_shortlist");
  const market = transferMarketOf(transferList, careerList(db, save, "career_loaned_list"));
  const prestigeOf = (teamId: number) => teams.get(teamId)?.prestige ?? null;
  const context: Context = {
    ...datesOf(db, save),
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
    rate: rater(db, save, curves, afterSigning),
    formationCodes: save === undefined ? [] : userFormationCodes(db, save),
    finance:
      save === undefined
        ? null
        : financeOf(db, save, { loanedFrom: market.loanedFrom, prestigeOf, afterSigning }),
    ...careerParts(db, save, placements),
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
  // stars and roles in place before withNameOrder freezes its copies.
  const [starsOf, rolesOf] = [clubStarsOf(summaries, links), rolesIn(db, save, links, summaries)];
  return withNameOrder(
    summaries.map((player) =>
      Object.assign(player, { clubStars: starsOf(player.clubId), ...rolesOf(player) }),
    ),
  );
};
