// The card's section on signing (roadmap 56(a)): while the values after signing show, what the
// transfer changes, before and after, for the values that change; nothing for anyone signing leaves as he is.
import type { ReactNode } from "react";
import type { Player } from "../logic/players.ts";
import { AttributeValue } from "./attribute-value.tsx";
import { Facts } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
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

export const SigningFacts = (props: {
  /** The player before signing, as the offer counts him. */
  before: Player;
  /** The player the card shows: after signing while that setting is on. */
  after: Player;
  showPotential: boolean;
}) => {
  const facts = ratingFacts(props.before, props.after, props.showPotential);
  return facts.length === 0 ? null : (
    <section aria-labelledby="signing-title">
      <h3 id="signing-title">{SIGNING_TEXT.card.title}</h3>
      <Facts facts={facts} />
    </section>
  );
};
