// What a transfer offer needs to succeed, from the game's decision code (docs: negotiation spec, 4 of 4
// stored offers reproduced): the fee the selling club accepts and the least wage the player signs for,
// for the conditions chosen on the offer form (single or double offer, bonus, contract length; by default
// a single offer, no bonus and the length he wants). The hard refusals (a thin squad, rival clubs, a full
// squad of yours) are not checked here.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import { teamsById } from "./placements.ts";
import type { Player } from "./players.ts";

/** The user's side of every offer. */
export interface OfferContext {
  /** team_manager.prestige and upgrade_fin, the negotiator's level. */
  readonly prestige: number;
  readonly negotiator: number;
  /** The integer mean OVR of the user's squad at its team-sheet positions. */
  readonly squadAverage: number;
  /** The country of the user's club's league; null when unknown. */
  readonly countryId: number | null;
  /** The calendar year the season ends in; ages for the contract count to it. */
  readonly seasonEndYear: number;
}

/** The offer form's bonus percentages of the wage. */
export const BONUS_PERCENTS = [0, 5, 10, 15] as const;

/** The conditions picked on the offer form; null years mean the length the player wants. */
export interface OfferChoice {
  readonly double: boolean;
  readonly bonusPercent: number;
  readonly years: number | null;
}

export const DEFAULT_CHOICE: OfferChoice = { double: false, bonusPercent: 0, years: null };

export interface OfferTerms {
  /** The least fee the club accepts; null when the contract has run out and only the player decides. */
  readonly fee: number | null;
  /** The fee is above what the first offer's limit allows (1.5 times the value). */
  readonly feeOverCap: boolean;
  /** The contract length he wants; 0 when any contract would outlast his career. */
  readonly wantedYears: number;
  /** The longest contract the form allows him: up to five years, none past the end of his career. */
  readonly longestYears: number;
  /** The contract length the wage is for. */
  readonly years: number;
  /** The least wage per match he signs for at that length; null when he will not sign. */
  readonly wage: number | null;
  /** The wage is above what the first offer's limit allows (1.5 times the market wage). */
  readonly wageOverCap: boolean;
}

/** Live values of the game's tuning registry (RAM dump) and the offer form's limits (handler 0x08893648). */
const OFFER_TUNING = {
  listedDivider: 39,
  poachedDivider: 20,
  wageDivider: 15,
  strengthWeight: 0.75,
  prestigeOffset: -5,
  sameCountryPoints: 2,
  bigLeaguePoints: 1,
  highIdentificationPoints: -2,
  lowIdentificationPoints: 2,
  /** England, France, Germany, Italy, Spain: a club there earns a point with any player. */
  bigLeagueCountryIds: [14, 18, 21, 27, 45],
  doubleOfferPoints: 2,
  /** The bonus is wage * percent / 100 euro and earns trunc(bonus * 20 / W) points. */
  bonusMultiplier: 20,
  /** The form allows up to this multiple of its base: the value or the market wage, or the last offer. */
  capMultipleOfBase: 1.5,
  maxContractYears: 5,
} as const;

/** The least fee the club accepts for a player of this value. */
const feeNeeded = (
  value: number,
  listed: boolean,
  { prestige, negotiator }: OfferContext,
): number => {
  const t = OFFER_TUNING;
  // A listed player's fee counts with a prestige bonus: fee (1 + p (1 + f/10) / 39) >= value. An unlisted
  // one costs a premium: value (1 + (10 - (p + f) // 2) / 20). Whole-number ratios keep it exact.
  return listed
    ? Math.ceil(
        (value * 10 * t.listedDivider) / (10 * t.listedDivider + prestige * (10 + negotiator)),
      )
    : Math.ceil(
        (value * (t.poachedDivider + 10 - Math.floor((prestige + negotiator) / 2))) /
          t.poachedDivider,
      );
};

/** His points from everything but the wage, the contract length and the double offer. */
const pointsBeforeWage = (player: Player, context: OfferContext): number => {
  const t = OFFER_TUNING;
  const country = context.countryId;
  const nation =
    player.nationalityId === country
      ? t.sameCountryPoints
      : t.bigLeagueCountryIds.some((id) => id === country)
        ? t.bigLeaguePoints
        : 0;
  const identification = player.traits.includes("highclubidentification")
    ? t.highIdentificationPoints
    : player.traits.includes("lowclubidentification")
      ? t.lowIdentificationPoints
      : 0;
  return (
    Math.trunc((context.squadAverage - player.overall) * t.strengthWeight) +
    2 * t.prestigeOffset +
    context.prestige +
    context.negotiator +
    nation +
    identification
  );
};

/**
 * The points of a wage and its bonus against the market wage W: the wage term is trunc(15 (wage - W) / W),
 * one less below W; the bonus (wage * percent / 100) earns trunc(bonus * 20 / W). Not decreasing in the wage.
 */
const wagePoints = (wage: number, market: number, bonusPercent: number): number => {
  const t = OFFER_TUNING;
  return (
    Math.trunc((t.wageDivider * (wage - market)) / market) -
    (wage < market ? 1 : 0) +
    Math.trunc((wage * bonusPercent * t.bonusMultiplier) / (100 * market))
  );
};

/** The least whole wage whose wage and bonus terms give `needed` points. */
const wageNeeded = (market: number, needed: number, bonusPercent: number): number => {
  if (market <= 0) return 0;
  const enough = (wage: number): boolean => wagePoints(wage, market, bonusPercent) >= needed;
  let high = market;
  while (!enough(high)) high *= 2;
  let low = 0;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (enough(middle)) high = middle;
    else low = middle + 1;
  }
  return low;
};

/** The terms of a successful offer, or null without a market wage (no club, no career). */
export const offerTerms = (
  player: Player,
  context: OfferContext,
  choice: OfferChoice = DEFAULT_CHOICE,
): OfferTerms | null => {
  if (player.wage === null) return null;
  const t = OFFER_TUNING;
  const value = player.price ?? 0;
  const fee = value === 0 ? null : feeNeeded(value, player.transferListed, context);
  const endAge = context.seasonEndYear - player.birthYear;
  const career = Math.max(0, player.retirementAge - endAge);
  const wantedYears = Math.min(career, (player.id % 5) + 1);
  const longestYears = Math.min(career, t.maxContractYears);
  const years = choice.years ?? wantedYears;
  const base =
    pointsBeforeWage(player, context) +
    (choice.double ? t.doubleOfferPoints : 0) -
    Math.abs(years - wantedYears);
  const wage =
    years < 1 || years > career ? null : wageNeeded(player.wage, -base, choice.bonusPercent);
  return {
    fee,
    feeOverCap: fee !== null && fee > value * t.capMultipleOfBase,
    wantedYears,
    longestYears,
    years,
    wage,
    wageOverCap: wage !== null && wage > player.wage * t.capMultipleOfBase,
  };
};

/** Team-sheet positions from 32 up are the bench and the reserves, rated at the preferred position. */
const BENCH_POSITION_FROM = 32;

/** The user's side of every offer, from the career save and the players built from it. */
export const offerContextOf = (
  db: EaDb,
  save: CareerSave,
  players: readonly Player[],
): OfferContext => {
  const { teamId, prestige, negotiator } = careerManager(db, save);
  const byId = new Map(players.map((player) => [player.id, player]));
  const ratings = effectiveRows(db, save, "teamplayerlinks")
    .filter((link) => Number(link["teamid"]) === teamId)
    .flatMap((link) => {
      const player = byId.get(Number(link["playerid"]));
      const position = Number(link["position"]);
      if (player === undefined) return [];
      const code = position < BENCH_POSITION_FROM ? position : player.positionCode;
      return [player.overallByCode[code] ?? player.overall];
    });
  const total = ratings.reduce((sum, rating) => sum + rating, 0);
  const leagueId = teamsById(db, save).get(teamId)?.leagueId;
  const league = readTable(db, "leagues").find((row) => Number(row["leagueid"]) === leagueId);
  return {
    prestige,
    negotiator,
    squadAverage: ratings.length === 0 ? 0 : Math.floor(total / ratings.length),
    countryId: league?.["countryid"] === undefined ? null : Number(league["countryid"]),
    seasonEndYear: seasonStartDate(db, save).getUTCFullYear() + 1,
  };
};
