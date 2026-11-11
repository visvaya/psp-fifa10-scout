// The card's money and contract rows: price, wage, a loaned player's prospects once back, and the contract.
import type { CurrencyCode } from "../data/career-save.ts";
import { valueRangeIn } from "../logic/player-finance.ts";
import type { Player } from "../logic/players.ts";
import type { Fact } from "./facts.tsx";
import { MissingValue } from "./player-list.tsx";
import { RANGE_LABELS, TEXT } from "./text.ts";
import { FIELD_HELP, HELP_TEXT } from "./text-help.ts";

/**
 * Price and wage, career only: the user's squad shows its stored wage, others an estimate. A loaned
 * player has no price and, unless lent by the user's club or to it, no wage: a dash for each.
 */
export const money = (
  { price, wage, storedWage, loanedFromId, returnValuesEuro }: Player,
  currency: CurrencyCode | null,
): readonly Fact[] =>
  currency === null || (price === null && loanedFromId === null)
    ? []
    : [
        [
          TEXT.card.price,
          price === null ? <MissingValue key="price" /> : TEXT.card.money(price, currency),
          FIELD_HELP.price,
        ],
        [
          storedWage ? TEXT.card.contractWage : TEXT.card.wage,
          wage === null ? <MissingValue key="wage" /> : TEXT.card.money(wage, currency),
          FIELD_HELP.wage,
        ],
        ...returnFacts(returnValuesEuro, currency),
      ];

/** A loaned player's contract and price once back at his parent club; nothing for anyone else. */
const returnFacts = (
  valuesEuro: readonly number[] | null,
  currency: CurrencyCode,
): readonly Fact[] => {
  const range = valueRangeIn(valuesEuro, currency);
  return range === null
    ? []
    : [
        [TEXT.card.returnContract, TEXT.card.returnContractYears, HELP_TEXT.loanReturn],
        [
          TEXT.card.returnPrice,
          TEXT.card.moneyRange(
            TEXT.card.money(range.lowest, currency),
            TEXT.card.money(range.highest, currency),
          ),
        ],
      ];
};

/** The contract's end year and the years left to it, as the game counts them. */
export const contractFacts = (player: Player): readonly Fact[] => [
  [TEXT.card.contract, player.contractEndYear ?? <MissingValue key="contract" />],
  [
    RANGE_LABELS.contractYearsLeft,
    player.contractYearsLeft ?? <MissingValue key="contract-years" />,
    FIELD_HELP.contractYearsLeft,
  ],
];
