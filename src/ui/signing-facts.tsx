// The card's section on the profile (roadmap 56(a), (c), 123): while the profile after a transfer or at the
// peak shows, what it changes, today and in the profile, for the values that change; after a transfer his
// price for any contract and his wage at the user's club; nothing for anyone the profile leaves as he is.
import type { ReactNode } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { valueRangeIn } from "../logic/player-finance.ts";
import type { ProfileMode } from "../logic/player-rating.ts";
import type { Player } from "../logic/players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { Facts } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
import { MissingValue } from "./player-list.tsx";
import { RANGE_LABELS, TEXT } from "./text.ts";
import { SIGNING_HELP, SIGNING_LABELS, SIGNING_TEXT } from "./text-signing.ts";

/** The section's title and the words of its arrow for a profile. */
interface Words {
  readonly title: string;
  readonly before: string;
  readonly after: string;
}

const wordsOf = ({ afterSigning, atPeak }: ProfileMode): Words => {
  const { card } = SIGNING_TEXT;
  if (!atPeak) return { title: card.title, before: card.before, after: card.after };
  return afterSigning
    ? { title: card.bothTitle, before: card.today, after: card.bothAfter }
    : { title: card.peakTitle, before: card.today, after: card.atPeak };
};

/** Before and after, the arrow read out in words. */
const pairIn =
  (words: Words) =>
  (before: ReactNode, after: ReactNode): ReactNode => (
    <>
      {before}
      <span className="visually-hidden">{` ${words.before},`}</span>
      <span aria-hidden="true">{SIGNING_TEXT.card.arrow}</span>
      {after}
      <span className="visually-hidden">{` ${words.after}`}</span>
    </>
  );

type Pair = ReturnType<typeof pairIn>;

/** His age in the profile at the peak, when it is another season's. */
const ageFacts = (before: Player, after: Player, pair: Pair): readonly Fact[] =>
  before.age === after.age
    ? []
    : [[TEXT.card.age, pair(TEXT.years(before.age), TEXT.years(after.age))]];

type Rated = "overall" | "potential" | "peak" | "bestPeak";

const RATED: readonly (readonly [Rated, string, boolean])[] = [
  ["overall", TEXT.columns.overall, false],
  ["potential", TEXT.card.potential, true],
  ["peak", RANGE_LABELS.peak, true],
  ["bestPeak", TEXT.card.bestPeak, true],
];

/** The ratings that change, the potential's values only while the potential shows. */
const ratingFacts = (
  before: Player,
  after: Player,
  { showPotential, pair }: { readonly showPotential: boolean; readonly pair: Pair },
): readonly Fact[] =>
  RATED.flatMap(([key, label, potential]): Fact[] => {
    const [from, to] = [before[key], after[key]];
    return (potential && !showPotential) || from === null || to === null || from === to
      ? []
      : [[label, pair(<AttributeValue value={from} />, <AttributeValue value={to} />)]];
  });

/**
 * His price before and at the user's club for a contract of 1 to 5 years, his market wage before and
 * there, and the wage his offer needs there (decision 1b, 2026-11-14);
 * nothing for a player without values there (the user's squad, loaned players) or without a career.
 */
const moneyFacts = (
  before: Player,
  after: Player,
  { currency, pair }: { readonly currency: CurrencyCode | null; readonly pair: Pair },
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
    [SIGNING_LABELS.transferWage, money(after.transferWage), SIGNING_HELP.transferWage],
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
  /** The profile the card shows. */
  profile: ProfileMode;
}) => {
  const { before, after, showPotential, currency } = props;
  // The same player: no profile is on.
  if (before === after) return null;
  const words = wordsOf(props.profile);
  const pair = pairIn(words);
  const facts = [
    ...ageFacts(before, after, pair),
    ...ratingFacts(before, after, { showPotential, pair }),
    ...moneyFacts(before, after, { currency, pair }),
  ];
  return facts.length === 0 ? null : (
    <section aria-labelledby="signing-title">
      <h3 id="signing-title">{words.title}</h3>
      <Facts facts={facts} />
    </section>
  );
};
