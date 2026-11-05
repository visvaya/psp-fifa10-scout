// What a transfer offer needs to succeed, from the game's decision code (docs: negotiation spec, 4 of 4
// stored offers reproduced): the fee the selling club accepts and the least wage the player signs for,
// with the contract length he wants. No double offer and no bonus; the hard refusals (a thin squad,
// rival clubs, a full squad of yours) are not checked here.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import { teamsById } from "./placements.ts";
import type { Player } from "./players.ts";

/** The user's side of every offer. */
export interface OfferContext {
  /** team_manager.prestige and upgrade_fin. */
  readonly prestige: number;
  readonly finance: number;
  /** The integer mean OVR of the user's squad at its team-sheet positions. */
  readonly squadAverage: number;
  /** The country of the user's club's league; null when unknown. */
  readonly countryId: number | null;
  /** The calendar year the season ends in; ages for the contract count to it. */
  readonly seasonEndYear: number;
}

export interface OfferTerms {
  /** The least fee the club accepts; null when the contract has run out and only the player decides. */
  readonly fee: number | null;
  /** The fee is above what the offer form allows (about 125 % of the value). */
  readonly feeOverCap: boolean;
  /** The contract length the player wants; 0 when any contract would outlast his career. */
  readonly years: number;
  /** The least wage per match he signs for at that length; null when he will not sign. */
  readonly wage: number | null;
  /** The wage is above what the offer form allows (about 120 % of the market wage). */
  readonly wageOverCap: boolean;
}

/** Live values of the game's tuning registry (RAM dump) and the offer form's observed limits. */
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
  feeCapShare: 1.25,
  wageCapShare: 1.2,
} as const;

/** The least fee the club accepts for a player of this value. */
const feeNeeded = (value: number, listed: boolean, { prestige, finance }: OfferContext): number => {
  const t = OFFER_TUNING;
  // A listed player's fee counts with a prestige bonus: fee (1 + p (1 + f/10) / 39) >= value. An unlisted
  // one costs a premium: value (1 + (10 - (p + f) // 2) / 20). Whole-number ratios keep it exact.
  return listed
    ? Math.ceil((value * 10 * t.listedDivider) / (10 * t.listedDivider + prestige * (10 + finance)))
    : Math.ceil(
        (value * (t.poachedDivider + 10 - Math.floor((prestige + finance) / 2))) / t.poachedDivider,
      );
};

/** The contract length he wants (id % 5 + 1), no longer than his career has left. */
const yearsWanted = (player: Player, endAge: number): number => {
  const wanted = (player.id % 5) + 1;
  return endAge + wanted > player.retirementAge ? player.retirementAge - endAge : wanted;
};

/** His points from everything but the wage, at the length he wants. */
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
    context.finance +
    nation +
    identification
  );
};

/**
 * The least wage giving the wage term `needed` points: the term is trunc(15 (wage - W) / W), one less
 * below W. Above W it needs wage >= W (15 + needed) / 15; below W, strictly more than that.
 */
const wageNeeded = (market: number, needed: number): number => {
  const t = OFFER_TUNING;
  const edge = (market * (t.wageDivider + needed)) / t.wageDivider;
  if (needed > 0) return Math.ceil(edge);
  return needed === 0 ? market : Math.max(0, Math.floor(edge) + 1);
};

/** The terms of a successful offer, or null without a market wage (no club, no career). */
export const offerTerms = (player: Player, context: OfferContext): OfferTerms | null => {
  if (player.wage === null) return null;
  const value = player.price ?? 0;
  const fee = value === 0 ? null : feeNeeded(value, player.transferListed, context);
  const years = Math.max(0, yearsWanted(player, context.seasonEndYear - player.birthYear));
  const wage = years === 0 ? null : wageNeeded(player.wage, -pointsBeforeWage(player, context));
  return {
    fee,
    feeOverCap: fee !== null && fee > value * OFFER_TUNING.feeCapShare,
    years,
    wage,
    wageOverCap: wage !== null && wage > player.wage * OFFER_TUNING.wageCapShare,
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
  const { teamId, prestige, finance } = careerManager(db, save);
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
    finance,
    squadAverage: ratings.length === 0 ? 0 : Math.floor(total / ratings.length),
    countryId: league?.["countryid"] === undefined ? null : Number(league["countryid"]),
    seasonEndYear: seasonStartDate(db, save).getUTCFullYear() + 1,
  };
};
