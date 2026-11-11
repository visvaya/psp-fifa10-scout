// Each career player's transfer price and market wage (transfer-price.ts), with his club's prestige
// and his contract. The user's squad keeps the wages stored in the save. A loaned player's link holds
// no contract (game-knowledge: loans), so he gets no price, and a wage only from the user's records:
// the stored wage when he was lent by the user's club or to it.
import { careerManager, effectiveRows, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave, CurrencyCode } from "../data/career-save.ts";
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
  /**
   * A free agent's estimated value, in euro, once he signs for the user's club: the price formula with
   * that club's prestige and a contract of 1 to 5 years (index 0 to 4). The game gives him 0 until he
   * signs. Null for anyone else.
   */
  readonly signedValuesEuro: readonly number[] | null;
  /**
   * A loaned player's value, in euro, once back at his parent club next season: the season's turn renews
   * his contract by one draw of 1 to 5 years for every player (index 0 to 4). Null for anyone else, or
   * when the parent club's prestige is unknown.
   */
  readonly returnValuesEuro: readonly number[] | null;
}

export const NO_FINANCE: Finance = {
  price: null,
  wage: null,
  priceEuro: null,
  wageEuro: null,
  storedWage: false,
  signedValuesEuro: null,
  returnValuesEuro: null,
};

/** A player's money alone, to carry it over to another version of him. */
export const moneyOf = ({
  price,
  wage,
  priceEuro,
  wageEuro,
  storedWage,
  signedValuesEuro,
  returnValuesEuro,
}: Finance): Finance => ({
  price,
  wage,
  priceEuro,
  wageEuro,
  storedWage,
  signedValuesEuro,
  returnValuesEuro,
});

/**
 * A value by contract length (Finance.signedValuesEuro or returnValuesEuro) for a contract of `years`, in
 * the currency the list shows, rounded as the game rounds prices; null without values.
 */
export const valueIn = (
  valuesEuro: readonly number[] | null,
  years: number,
  currency: CurrencyCode,
): number | null => {
  const euro = valuesEuro?.[years - 1];
  return euro === undefined
    ? null
    : moneyIn({ priceEuro: euro, wageEuro: null, storedWage: false }, exchangeRate(currency)).price;
};

/** The lowest and highest of the values by contract length, in the shown currency; null without values. */
export const valueRangeIn = (
  valuesEuro: readonly number[] | null,
  currency: CurrencyCode,
): { readonly lowest: number; readonly highest: number } | null => {
  const shown = (valuesEuro ?? []).flatMap(
    (_, index) => valueIn(valuesEuro, index + 1, currency) ?? [],
  );
  return shown.length === 0 ? null : { lowest: Math.min(...shown), highest: Math.max(...shown) };
};

/** The links of the players at the game's free-agent team, by player. */
const freeAgentLinksOf = (db: EaDb, save: CareerSave): ReadonlyMap<number, EaDbRow> =>
  new Map(
    effectiveRows(db, save, "teamplayerlinks")
      .filter((link) => num(link, "teamid") === SCOUT_CONFIG.freeAgentTeamId)
      .map((link) => [num(link, "playerid"), link]),
  );

/** The user's squad's wages as the save stores them, by player. */
const storedWagesOf = (db: EaDb, save: CareerSave): ReadonlyMap<number, number> =>
  new Map(
    effectiveRows(db, save, "career_extra_user_team_info").map((row) => [
      num(row, "playerid"),
      // Stored in euro, not always round (raises in later seasons); the game shows it converted and
      // rounded at the units digit (four of four squad wages on its screen in dollars).
      float32(num(row, "wage")),
    ]),
  );

/**
 * His price input `years` seasons on, at his preferred position (not the club one: 12 of 12 prices read
 * off the game's screen agree); the caller sets the contract and the prestige.
 */
const priceInputOf =
  ({ row, age, overallAt }: Omit<FinanceInput, "club">) =>
  (years: number): PriceInput => {
    const preferred = num(row, "preferredposition1");
    return {
      positionCode: preferred,
      overall: overallAt(preferred, years),
      overallIn5Years: overallAt(preferred, years + PROJECTION_YEARS),
      age: age + years,
      contractYearsLeft: 0,
      internationalReputation: num(row, "internationalreputation"),
      playingStyle: num(row, "playingstyle"),
      prestige: 0,
    };
  };

/** No value once signed or once back. */
const NO_VALUES = { signedValuesEuro: null, returnValuesEuro: null } as const;

/** The contract lengths the offer form offers, in years. */
const CONTRACT_YEARS = [1, 2, 3, 4, 5] as const;

/** A free agent's price for each contract length, at the user's club's prestige. */
const signedValuesOf = (input: PriceInput, userPrestige: number | null): readonly number[] | null =>
  userPrestige === null
    ? null
    : CONTRACT_YEARS.map((years) =>
        priceInEuro({ ...input, contractYearsLeft: years, prestige: userPrestige }),
      );

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
  clubs: {
    /** Each loaned player's parent club. */
    readonly loanedFrom: ReadonlyMap<number, number>;
    /** A club's league prestige plus team prestige; null for a club in no league. */
    readonly prestigeOf: (teamId: number) => number | null;
  },
): ((input: FinanceInput) => Finance) => {
  const { loanedFrom, prestigeOf } = clubs;
  const { teamId: userTeamId, currency } = careerManager(db, save);
  const userPrestige = prestigeOf(userTeamId);
  const rate = exchangeRate(currency);
  const shown = (
    euro: EuroMoney,
    values: Pick<Finance, "signedValuesEuro" | "returnValuesEuro"> = NO_VALUES,
  ): Finance => ({ ...euro, ...moneyIn(euro, rate), ...values });
  // The game counts contract years from the year the season started: in April 2011 a contract to 2013
  // shows three years.
  const seasonYear = seasonStartDate(db, save).getUTCFullYear();
  const freeAgentLinks = freeAgentLinksOf(db, save);
  const storedWages = storedWagesOf(db, save);
  return ({ row, age, club, overallAt }) => {
    const id = num(row, "playerid");
    const inputIn = priceInputOf({ row, age, overallAt });
    const parent = loanedFrom.get(id);
    if (parent !== undefined) {
      const userLoan =
        parent === userTeamId || (club !== undefined && num(club.link, "teamid") === userTeamId);
      const stored = userLoan ? storedWages.get(id) : undefined;
      const values = {
        ...NO_VALUES,
        returnValuesEuro: signedValuesOf(inputIn(1), prestigeOf(parent)),
      };
      return stored === undefined
        ? { ...NO_FINANCE, ...values }
        : shown({ priceEuro: null, wageEuro: stored, storedWage: true }, values);
    }
    const link = club?.link ?? freeAgentLinks.get(id);
    if (link === undefined) return NO_FINANCE;
    const now = inputIn(0);
    const input: PriceInput = {
      ...now,
      contractYearsLeft: num(link, "yearcontractvalidtil") - seasonYear,
      // A free agent counts OVR / 5 as both league and team prestige.
      prestige: club?.prestige ?? 2 * Math.floor(now.overall / 5),
    };
    const stored = num(link, "teamid") === userTeamId ? storedWages.get(id) : undefined;
    const priceEuro = priceInEuro(input);
    const signedValuesEuro = club === undefined ? signedValuesOf(input, userPrestige) : null;
    return shown(
      stored === undefined
        ? {
            priceEuro,
            wageEuro: wageInEuro(input, input.contractYearsLeft <= 0),
            storedWage: false,
          }
        : { priceEuro, wageEuro: stored, storedWage: true },
      { ...NO_VALUES, signedValuesEuro },
    );
  };
};
