// Each career player's transfer price and market wage (transfer-price.ts), with his club's prestige
// and his contract. The user's squad keeps the wages stored in the save.
import { careerManager, effectiveRows } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { exchangeRate, marketWage, roundMoney, transferPrice } from "./transfer-price.ts";
import type { PriceInput } from "./transfer-price.ts";

export interface Finance {
  /** The asking price; 0 when the contract has run out. */
  readonly price: number | null;
  /** The market wage per match from the game's formula, or the stored wage of the user's squad. */
  readonly wage: number | null;
  /** The formula's wage with the free-transfer factor when the contract has run out, else the wage;
   * null for a stored wage. */
  readonly wageMax: number | null;
}

export const NO_FINANCE: Finance = { price: null, wage: null, wageMax: null };

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
  const { teamId: userTeamId, lastGameDate, currency } = careerManager(db, save);
  const rate = exchangeRate(currency);
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
      contractYearsLeft: num(link, "yearcontractvalidtil") - lastGameDate.getUTCFullYear(),
      internationalReputation: num(row, "internationalreputation"),
      playingStyle: num(row, "playingstyle"),
      // A free agent counts OVR / 5 as both league and team prestige.
      prestige: club?.prestige ?? 2 * Math.floor(overall / 5),
      exchangeRate: rate,
    };
    const stored = num(link, "teamid") === userTeamId ? storedWages.get(id) : undefined;
    const wage = marketWage(input, false);
    if (stored !== undefined) return { price: transferPrice(input), wage: stored, wageMax: null };
    const wageMax = input.contractYearsLeft <= 0 ? marketWage(input, true) : wage;
    return { price: transferPrice(input), wage, wageMax };
  };
};
