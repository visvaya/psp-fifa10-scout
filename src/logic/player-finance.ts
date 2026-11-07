// Each career player's transfer price and market wage (transfer-price.ts), with his club's prestige
// and his contract. The user's squad keeps the wages stored in the save. A loaned player's link holds
// no contract (game-knowledge: loans), so he gets no price, and a wage only from the user's records:
// the stored wage when he was lent by the user's club or to it.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { num } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { exchangeRate, moneyIn, priceInEuro, wageInEuro } from "./transfer-price.ts";
import type { EuroMoney, PriceInput } from "./transfer-price.ts";

/** Priced in the save's currency; the euro amounts let the reducer show another without a new load. */
export interface Finance extends EuroMoney {
  /** The asking price; 0 when the contract has run out, null for a loaned player. */
  readonly price: number | null;
  /** The market wage per match from the game's formula, with the free-transfer factor once the
   * contract has run out, or the stored wage of the user's squad. */
  readonly wage: number | null;
}

export const NO_FINANCE: Finance = {
  price: null,
  wage: null,
  priceEuro: null,
  wageEuro: null,
  storedWage: false,
};

export interface FinanceInput {
  readonly row: EaDbRow;
  readonly age: number;
  /** His club link and the club's league prestige plus team prestige; undefined without a club. */
  readonly club: { readonly link: EaDbRow; readonly prestige: number } | undefined;
  /** OVR at a position code, `yearsAhead` years older. */
  readonly overallAt: (positionCode: number, yearsAhead: number) => number;
}

/** The game's "_overall+5": the OVR the price formula projects. */
const PROJECTION_YEARS = 5;

/** A float32 stored as its u32 bits. */
const float32 = (bits: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
};

/**
 * Prices and wages on the save's date; players without a club or free-agent link get none. `loanedFrom`
 * maps each loaned player to his parent club.
 */
export const financeOf = (
  db: EaDb,
  save: CareerSave,
  loanedFrom: ReadonlyMap<number, number>,
): ((input: FinanceInput) => Finance) => {
  const { teamId: userTeamId, currency } = careerManager(db, save);
  const rate = exchangeRate(currency);
  const shown = (euro: EuroMoney): Finance => ({ ...euro, ...moneyIn(euro, rate) });
  // The game counts contract years from the year the season started: in April 2011 a contract to 2013
  // shows three years.
  const seasonYear = seasonStartDate(db, save).getUTCFullYear();
  const freeAgentLinks = new Map(
    effectiveRows(db, save, "teamplayerlinks")
      .filter((link) => num(link, "teamid") === SCOUT_CONFIG.freeAgentTeamId)
      .map((link) => [num(link, "playerid"), link]),
  );
  const storedWages = new Map(
    effectiveRows(db, save, "career_extra_user_team_info").map((row) => [
      num(row, "playerid"),
      // Stored in euro, not always round (raises in later seasons); the game shows it converted and
      // rounded at the units digit (four of four squad wages on its screen in dollars).
      float32(num(row, "wage")),
    ]),
  );
  return ({ row, age, club, overallAt }) => {
    const id = num(row, "playerid");
    if (loanedFrom.has(id)) {
      const userLoan =
        loanedFrom.get(id) === userTeamId ||
        (club !== undefined && num(club.link, "teamid") === userTeamId);
      const stored = userLoan ? storedWages.get(id) : undefined;
      return stored === undefined
        ? NO_FINANCE
        : shown({ priceEuro: null, wageEuro: stored, storedWage: true });
    }
    const link = club?.link ?? freeAgentLinks.get(id);
    if (link === undefined) return NO_FINANCE;
    // The preferred position, not the club one: 12 of 12 prices read off the game's screen agree.
    const preferred = num(row, "preferredposition1");
    const overall = overallAt(preferred, 0);
    const input: PriceInput = {
      positionCode: preferred,
      overall,
      overallIn5Years: overallAt(preferred, PROJECTION_YEARS),
      age,
      contractYearsLeft: num(link, "yearcontractvalidtil") - seasonYear,
      internationalReputation: num(row, "internationalreputation"),
      playingStyle: num(row, "playingstyle"),
      // A free agent counts OVR / 5 as both league and team prestige.
      prestige: club?.prestige ?? 2 * Math.floor(overall / 5),
    };
    const stored = num(link, "teamid") === userTeamId ? storedWages.get(id) : undefined;
    const priceEuro = priceInEuro(input);
    return shown(
      stored === undefined
        ? {
            priceEuro,
            wageEuro: wageInEuro(input, input.contractYearsLeft <= 0),
            storedWage: false,
          }
        : { priceEuro, wageEuro: stored, storedWage: true },
    );
  };
};
