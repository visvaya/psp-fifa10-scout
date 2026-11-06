// Each career player's transfer price and market wage (transfer-price.ts), with his club's prestige
// and his contract. The user's squad keeps the wages stored in the save.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { exchangeRate, marketWage, roundMoney, transferPrice } from "./transfer-price.ts";
import type { PriceInput } from "./transfer-price.ts";

export interface Finance {
  /** The asking price; 0 when the contract has run out. */
  readonly price: number | null;
  /** The market wage per match from the game's formula, with the free-transfer factor once the
   * contract has run out, or the stored wage of the user's squad. */
  readonly wage: number | null;
  /** The wage is the one stored in the contract of the user's player, not the market wage. */
  readonly storedWage: boolean;
}

export const NO_FINANCE: Finance = { price: null, wage: null, storedWage: false };

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

const num = (row: EaDbRow, key: string): number => Number(row[key]);

/** A float32 stored as its u32 bits. */
const float32 = (bits: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
};

/** Prices and wages on the save's date; players without a club or free-agent link get none. */
export const financeOf = (db: EaDb, save: CareerSave): ((input: FinanceInput) => Finance) => {
  const { teamId: userTeamId, currency } = careerManager(db, save);
  const rate = exchangeRate(currency);
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
      roundMoney(float32(num(row, "wage")) * rate),
    ]),
  );
  return ({ row, age, club, overallAt }) => {
    const id = num(row, "playerid");
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
      exchangeRate: rate,
    };
    const stored = num(link, "teamid") === userTeamId ? storedWages.get(id) : undefined;
    const price = transferPrice(input);
    return stored === undefined
      ? { price, wage: marketWage(input, input.contractYearsLeft <= 0), storedWage: false }
      : { price, wage: stored, storedWage: true };
  };
};
