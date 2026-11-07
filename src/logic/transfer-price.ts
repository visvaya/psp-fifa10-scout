// Transfer price and market wage of a career player, as FIFA 10 (PSP) computes them: the value routine
// at vaddr 0x088F1888 and the wage routine at 0x088F0C9C of the game executable ULES01328.
//
// Source of the tuning values: the game's live tuning registry, read from RAM while the game runs; they
// differ from the defaults compiled into the executable (for example the divider 195, not 190).
// Verified on the game's transfer-market screen: 24 of 24 prices and 6 of 6 market wages exactly.
// The game keeps money in euro and converts it to the career's currency before its rounding (moneyIn).

import type { CurrencyCode } from "../data/career-save.ts";

/** Bands as [lowest value, adjustment], highest first; a value takes the first band it reaches. */
type Bands = readonly (readonly [number, number])[];

// Data rows, alike by nature. jscpd:ignore-start
const PRICE_TUNING = {
  valueLowestBase: 100_000,
  valueMagic: 39_000_000,
  valueDivider: 195,
  valuePower: 11,
  /** By contract years left (4 or more counts as 4). */
  valueContract: [
    [2, 0.3],
    [1, -0.1],
  ],
  /** By age: 36+, 31..35, 26..30, 21..25, up to 20. */
  valueAge: [
    [36, -0.6],
    [31, -0.3],
    [26, 0.1],
    [21, 0],
    [0, -0.05],
  ],
  /** By international reputation 1..5. */
  valueReputation: [
    [5, 0.35],
    [4, 0.1],
    [0, 0],
  ],
  /** By playing-style tier: gold, silver, bronze, none. */
  valueStyle: [0.15, 0.1, 0.05, -0.05],
  /** By league prestige plus team prestige. */
  valuePrestige: [
    [33, 0.1],
    [25, 0],
    [17, -0.1],
    [9, -0.25],
    [0, -0.35],
  ],
  valuePosition: { ST: 1.15, AM: 1.2, M: 0.85, DM: 0.75, CB: 0.75, FB: 0.7, GK: 0.6 },
  wageMagic: 40_000,
  wagePrestigeDivider: 40,
  wagePower: 2,
  wageOffset: 500,
  /** The registry lacks these keys, so the executable's defaults apply. */
  wageAge: [
    [36, -0.2],
    [31, 0.1],
    [26, 0],
    [21, -0.2],
    [0, -0.35],
  ],
  wageReputation: [
    [5, 0.2],
    [4, 0.1],
    [0, 0],
  ],
  wageStyle: [0.2, 0.1, 0.05, -0.05],
  wagePosition: { ST: 0.15, AM: 0.2, M: 0, DM: 0.1, CB: -0.05, FB: -0.1, GK: -0.1 },
  wageOverallDivider: 200,
  wageOverallPower: 5,
  wageOverallOffset: 0.05,
  wageOverallMultiplier: 3,
  /** The free-transfer factor, when the contract has run out. */
  wageBosmanMultiplier: 1.3,
  /** A goalkeeper counts this many years younger in the two oldest age bands. */
  goalkeeperAgeShiftYears: 5,
  /** Lowest OVR of the gold, silver and bronze playing-style tiers; style codes 0..12 have tiers. */
  styleTierOverallMin: [85, 80, 75],
  styleCodesBelow: 13,
  /** Per euro, by the save's currency code (`team_manager.currency`): euro, pound, dollar. Code 0 is the
   * euro on the game's screen; the pound and dollar order follows from the rates. */
  exchangeRates: [1, 0.86, 1.41],
} as const;

type PriceGroup = keyof typeof PRICE_TUNING.valuePosition;

/** The game's position groups for money, by lowest position code (codes 2 and 3 are full-backs);
 * codes 0 and 1 are goalkeepers. */
const PRICE_GROUPS: readonly (readonly [number, PriceGroup])[] = [
  [26, "ST"],
  [21, "AM"],
  [14, "M"],
  [9, "DM"],
  [7, "FB"],
  [4, "CB"],
  [2, "FB"],
];
// jscpd:ignore-end

export interface PriceInput {
  /** The preferred position. */
  readonly positionCode: number;
  /** OVR at the preferred position: prices read off the game's screen agree with it. */
  readonly overall: number;
  /** The same OVR five years older. */
  readonly overallIn5Years: number;
  readonly age: number;
  readonly contractYearsLeft: number;
  readonly internationalReputation: number;
  readonly playingStyle: number;
  /** League prestige plus team prestige. */
  readonly prestige: number;
}

/** A player's price and wage in euro, before the currency and the game's rounding; null when unknown. */
export interface EuroMoney {
  readonly priceEuro: number | null;
  readonly wageEuro: number | null;
  /** The wage is the one stored in a contract, which the game rounds as money, not as a price. */
  readonly storedWage: boolean;
}

/** The exchange rate of a currency code (`team_manager.currency`). */
export const exchangeRate = (currency: CurrencyCode): number =>
  PRICE_TUNING.exchangeRates[currency];

const band = (bands: Bands, value: number): number =>
  bands.find(([lowest]) => value >= lowest)?.[1] ?? 0;

const groupOf = (positionCode: number): PriceGroup =>
  PRICE_GROUPS.find(([lowest]) => positionCode >= lowest)?.[1] ?? "GK";

/** A goalkeeper counts five years younger, but only to reach the two oldest bands. */
const ageAdjustment = (bands: Bands, { age, positionCode }: PriceInput): number => {
  const shifted = positionCode === 0 ? age - PRICE_TUNING.goalkeeperAgeShiftYears : age;
  const oldest = bands.slice(0, 2).find(([lowest]) => shifted >= lowest);
  return oldest === undefined ? band(bands.slice(2), age) : oldest[1];
};

/** 0 gold, 1 silver, 2 bronze, 3 none. */
const styleTier = ({ playingStyle, overall }: PriceInput): number => {
  const tiers = PRICE_TUNING.styleTierOverallMin;
  if (playingStyle < 0 || playingStyle >= PRICE_TUNING.styleCodesBelow) return tiers.length;
  const tier = tiers.findIndex((lowest) => overall >= lowest);
  return tier === -1 ? tiers.length : tier;
};

const styleAdjustment = (adjustments: readonly number[], input: PriceInput): number =>
  adjustments[styleTier(input)] ?? 0;

/** The game's rounding of money on screen (wages, budget): to whole units, then the units digit at 6. */
export const roundMoney = (amount: number): number => {
  const whole = Math.floor(amount + 0.5);
  const units = whole % 10;
  return whole - units + (units >= 6 ? 10 : 0);
};

/** The game's rounding of prices (vaddr 0x08972914): roundMoney, then two significant digits half up. */
export const roundPrice = (amount: number): number => {
  const rounded = roundMoney(amount);
  let power = 1;
  while (power < rounded) power *= 10;
  if (power < 1000) return rounded;
  const unit = power / 100;
  return Math.floor((rounded + power / 200) / unit) * unit;
};

/** The asking price in euro, before rounding; 0 when the contract has no years left. */
export const priceInEuro = (input: PriceInput): number => {
  if (input.contractYearsLeft <= 0) return 0;
  const t = PRICE_TUNING;
  const sum = (input.overall + input.overallIn5Years) / t.valueDivider;
  const base = t.valueLowestBase + t.valueMagic * sum ** t.valuePower;
  const adjustments = [
    band(t.valueContract, input.contractYearsLeft),
    band(t.valueReputation, input.internationalReputation),
    ageAdjustment(t.valueAge, input),
    styleAdjustment(t.valueStyle, input),
    band(t.valuePrestige, input.prestige),
  ];
  // An adjustment that would take the total to zero or below is skipped.
  const total = adjustments.reduce(
    (current, k) => (current + k * base > 0 ? current + k * base : current),
    base,
  );
  return total * t.valuePosition[groupOf(input.positionCode)];
};

/** The market wage per match in euro, before rounding; `bosman` adds the free-transfer factor. */
export const wageInEuro = (input: PriceInput, bosman: boolean): number => {
  const t = PRICE_TUNING;
  const base = t.wageMagic * (input.prestige / t.wagePrestigeDivider) ** t.wagePower;
  const k =
    t.wagePosition[groupOf(input.positionCode)] +
    ageAdjustment(t.wageAge, input) +
    styleAdjustment(t.wageStyle, input) +
    band(t.wageReputation, input.internationalReputation);
  const rating = (input.overall + input.overallIn5Years) / t.wageOverallDivider;
  const factor = (rating ** t.wageOverallPower + t.wageOverallOffset) * t.wageOverallMultiplier;
  const wage = (base + t.wageOffset + k * base) * factor;
  return bosman ? wage * t.wageBosmanMultiplier : wage;
};

/** The price and wage as the game shows them in a currency of this rate: converted, then rounded. */
export const moneyIn = (
  { priceEuro, wageEuro, storedWage }: EuroMoney,
  rate: number,
): { readonly price: number | null; readonly wage: number | null } => ({
  price: priceEuro === null ? null : roundPrice(priceEuro * rate),
  wage: wageEuro === null ? null : (storedWage ? roundMoney : roundPrice)(wageEuro * rate),
});
