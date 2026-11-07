// The currency money shows in: the career's until the user picks another (owner, 2026-11-07). Amounts
// come from euro with the game's rate and rounding, as if the career used that currency; money filters
// keep the same amount of money in the new currency.
import type { CurrencyCode } from "../data/career-save.ts";
import type { Range } from "./filter-players.ts";
import type { Player } from "./players.ts";
import type { ScoutFilters, ScoutState } from "./scout-state.ts";
import { exchangeRate, moneyIn } from "./transfer-price.ts";

export const isCurrency = (value: unknown): value is CurrencyCode =>
  value === 0 || value === 1 || value === 2;

/** The currency money shows in; null without a career, which alone has money. */
export const shownCurrency = ({
  career,
  currency,
}: Pick<ScoutState, "career" | "currency">): CurrencyCode | null =>
  career === null ? null : (currency ?? career.currency);

/** The players with their prices and wages in a currency, from their euro amounts. */
export const pricedIn = (players: readonly Player[], currency: CurrencyCode): readonly Player[] => {
  const rate = exchangeRate(currency);
  return players.map((player) => ({ ...player, ...moneyIn(player, rate) }));
};

const MONEY_KEYS = ["price", "wage"] as const;

/** The state with its players priced in the shown currency: a load brings them in the save's one. */
export const withShownCurrency = (before: ScoutState, after: ScoutState): ScoutState => {
  const shown = shownCurrency(after);
  const pricedAs =
    after.players === before.players ? shownCurrency(before) : (after.career?.currency ?? null);
  return shown === null || shown === pricedAs || after.players === null
    ? after
    : { ...after, players: pricedIn(after.players, shown) };
};

/** The money filters' bounds in another currency: the same amount of money, in whole units. */
export const moneyFiltersIn = (
  filters: ScoutFilters,
  from: CurrencyCode,
  to: CurrencyCode,
): ScoutFilters => {
  const { ranges } = filters;
  if (from === to || ranges === undefined) return filters;
  const ratio = exchangeRate(to) / exchangeRate(from);
  const converted = ({ min, max }: Range): Range => ({
    ...(min === undefined ? {} : { min: Math.round(min * ratio) }),
    ...(max === undefined ? {} : { max: Math.round(max * ratio) }),
  });
  const money = MONEY_KEYS.flatMap((key) => {
    const range = ranges[key];
    return range === undefined ? [] : [[key, converted(range)] as const];
  });
  return { ...filters, ranges: { ...ranges, ...Object.fromEntries(money) } };
};

/** The chosen currency, with the players and the money filters' bounds in it (undo.ts clears the steps). */
export const currencyChosen = (state: ScoutState, currency: CurrencyCode): ScoutState => {
  const from = shownCurrency(state);
  const chosen = { ...state, currency };
  return from === null
    ? chosen
    : withShownCurrency(state, {
        ...chosen,
        filters: moneyFiltersIn(state.filters, from, currency),
      });
};
