// The card's section on the transfer (roadmap 56(a), (c)): while the profile after a transfer shows, what
// the transfer changes, before and after, for the values that change, and his price for any contract and
// his wage at the user's club; nothing for anyone the transfer leaves as he is.
import type { ReactNode } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { valueRangeIn } from "../logic/player-finance.ts";
import type { Player } from "../logic/players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { Facts } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
import { MissingValue } from "./player-list.tsx";
import { RANGE_LABELS, TEXT } from "./text.ts";
import { SIGNING_TEXT } from "./text-signing.ts";

/** Before and after, the arrow read out in words. */
const pair = (before: ReactNode, after: ReactNode): ReactNode => (
  <>
    {before}
    <span className="visually-hidden">{` ${SIGNING_TEXT.card.before},`}</span>
    <span aria-hidden="true">{SIGNING_TEXT.card.arrow}</span>
    {after}
    <span className="visually-hidden">{` ${SIGNING_TEXT.card.after}`}</span>
  </>
);

type Rated = "overall" | "potential" | "peak" | "bestPeak";

const RATED: readonly (readonly [Rated, string, boolean])[] = [
  ["overall", TEXT.columns.overall, false],
  ["potential", TEXT.card.potential, true],
  ["peak", RANGE_LABELS.peak, true],
  ["bestPeak", TEXT.card.bestPeak, true],
];

/** The ratings that change, the potential's values only while the potential shows. */
const ratingFacts = (before: Player, after: Player, showPotential: boolean): readonly Fact[] =>
  RATED.flatMap(([key, label, potential]): Fact[] => {
    const [from, to] = [before[key], after[key]];
    return (potential && !showPotential) || from === null || to === null || from === to
      ? []
      : [[label, pair(<AttributeValue value={from} />, <AttributeValue value={to} />)]];
  });

/**
 * His price before and at the user's club for a contract of 1 to 5 years, and his wage before and there;
 * nothing for a player without values there (the user's squad, loaned players) or without a career.
 */
const moneyFacts = (
  before: Player,
  after: Player,
  currency: CurrencyCode | null,
): readonly Fact[] => {
  const range = currency === null ? null : valueRangeIn(after.signedValuesEuro, currency);
  if (currency === null || range === null || after.signedWageEuro === null) return [];
  const money = (amount: number | null) =>
    amount === null ? <MissingValue /> : TEXT.card.money(amount, currency);
  return [
    [
      SIGNING_TEXT.card.priceRange,
      pair(
        money(before.price),
        TEXT.card.moneyRange(
          TEXT.card.money(range.lowest, currency),
          TEXT.card.money(range.highest, currency),
        ),
      ),
    ],
    [TEXT.card.wage, pair(money(before.wage), money(after.wage))],
  ];
};

export const SigningFacts = (props: {
  /** The player before signing, as the offer counts him. */
  before: Player;
  /** The player the card shows: after the transfer while that setting is on. */
  after: Player;
  showPotential: boolean;
  /** The currency money shows in, null without a career. */
  currency: CurrencyCode | null;
}) => {
  const { before, after } = props;
  // The same player: the profile after a transfer is off.
  if (before === after) return null;
  const facts = [
    ...ratingFacts(before, after, props.showPotential),
    ...moneyFacts(before, after, props.currency),
  ];
  return facts.length === 0 ? null : (
    <section aria-labelledby="signing-title">
      <h3 id="signing-title">{SIGNING_TEXT.card.title}</h3>
      <Facts facts={facts} />
    </section>
  );
};
