// The card's offer section: what an offer needs to succeed (offer.ts) for the conditions picked here.
// The choices are local to the card and start from the defaults on every card.
import { useState } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { BONUS_PERCENTS, DEFAULT_CHOICE, offerTerms } from "../logic/offer.ts";
import type { OfferChoice, OfferContext, OfferTerms } from "../logic/offer.ts";
import { signedValueIn } from "../logic/player-finance.ts";
import type { Player } from "../logic/players.ts";
import { Facts } from "./facts.tsx";
import type { Fact } from "./facts.tsx";
import { HelpHeading, WarnedValue } from "./field-help.tsx";
import { CheckField } from "./filter-fields.tsx";
import { TEXT } from "./text.ts";
import { HELP_TEXT, WARNING_TEXT } from "./text-help.ts";
import { OFFER_TEXT } from "./text-offer.ts";

const range = (count: number): readonly number[] => Array.from({ length: count }, (_, i) => i + 1);

/** The three conditions of the offer form: double offer, bonus and contract length. */
const OfferControls = (props: {
  choice: OfferChoice;
  terms: OfferTerms;
  onChange: (choice: OfferChoice) => void;
}) => {
  const { choice, terms, onChange } = props;
  return (
    <div className="offer-controls">
      <CheckField
        label={OFFER_TEXT.double}
        checked={choice.double}
        help={HELP_TEXT.doubleOffer}
        onChange={(double) => {
          onChange({ ...choice, double });
        }}
      />
      <label className="field">
        <span>{OFFER_TEXT.bonus}</span>
        <select
          value={choice.bonusPercent}
          onChange={(event) => {
            onChange({ ...choice, bonusPercent: Number(event.currentTarget.value) });
          }}
        >
          {BONUS_PERCENTS.map((percent) => (
            <option key={percent} value={percent}>
              {OFFER_TEXT.bonusOption(percent)}
            </option>
          ))}
        </select>
      </label>
      {terms.longestYears < 1 ? null : (
        <label className="field">
          <span>{OFFER_TEXT.length}</span>
          <select
            value={terms.years}
            onChange={(event) => {
              onChange({ ...choice, years: Number(event.currentTarget.value) });
            }}
          >
            {range(terms.longestYears).map((years) => (
              <option key={years} value={years}>
                {OFFER_TEXT.lengthOption(TEXT.years(years), years === terms.wantedYears)}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};

/** A free agent's estimated value once signed, for the chosen contract; nothing for anyone else. */
const signedValueFacts = (value: number | null, currency: CurrencyCode): readonly Fact[] =>
  value === null
    ? []
    : [[OFFER_TEXT.signedValue, TEXT.card.money(value, currency), OFFER_TEXT.signedValueHelp]];

export const OfferFacts = (props: {
  player: Player;
  context: OfferContext;
  currency: CurrencyCode;
}) => {
  const { player, context, currency } = props;
  const [choice, setChoice] = useState<OfferChoice>(DEFAULT_CHOICE);
  const terms = offerTerms(player, context, choice);
  if (terms === null) return null;
  const { fee, wage, years, bonus } = terms;
  const signedValue = signedValueIn(player, years, currency);
  return (
    <section aria-labelledby="offer-title">
      <HelpHeading id="offer-title" title={OFFER_TEXT.title} help={HELP_TEXT.offer} />
      <OfferControls choice={choice} terms={terms} onChange={setChoice} />
      <div aria-live="polite" aria-atomic="true">
        <Facts
          facts={[
            [
              OFFER_TEXT.fee,
              <WarnedValue
                key="fee"
                label={OFFER_TEXT.fee}
                warning={terms.feeOverCap ? WARNING_TEXT.feeOverCap : null}
              >
                {fee === null ? OFFER_TEXT.noFee : TEXT.card.money(fee, currency)}
              </WarnedValue>,
            ],
            [
              OFFER_TEXT.wage,
              <WarnedValue
                key="wage"
                label={OFFER_TEXT.wage}
                warning={terms.wageOverCap ? WARNING_TEXT.wageOverCap : null}
              >
                {wage === null
                  ? OFFER_TEXT.never
                  : OFFER_TEXT.wageValue(TEXT.card.money(wage, currency), TEXT.years(years))}
              </WarnedValue>,
            ],
            ...(bonus === 0
              ? []
              : [[OFFER_TEXT.bonusAmount, TEXT.card.money(bonus, currency)] as const]),
            ...signedValueFacts(signedValue, currency),
          ]}
        />
      </div>
      {player.saleRefusal === null ? null : (
        <p className="help">{OFFER_TEXT.refusals[player.saleRefusal]}</p>
      )}
    </section>
  );
};
