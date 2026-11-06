// The card's offer section: what an offer needs to succeed (offer.ts) for the conditions picked here.
// The choices are local to the card and start from the defaults on every card.
import { useState } from "react";
import type { CurrencyCode } from "../data/career-save.ts";
import { BONUS_PERCENTS, DEFAULT_CHOICE, offerTerms } from "../logic/offer.ts";
import type { OfferChoice, OfferContext, OfferTerms } from "../logic/offer.ts";
import type { Player } from "../logic/players.ts";
import { Facts } from "./facts.tsx";
import { TEXT } from "./text.ts";
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
      <label className="check">
        <input
          type="checkbox"
          checked={choice.double}
          onChange={(event) => {
            onChange({ ...choice, double: event.currentTarget.checked });
          }}
        />
        {OFFER_TEXT.double}
      </label>
      {choice.double ? <p className="help">{OFFER_TEXT.doubleCost}</p> : null}
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
  return (
    <section aria-labelledby="offer-title">
      <h3 id="offer-title">{OFFER_TEXT.title}</h3>
      <p className="help">{OFFER_TEXT.note}</p>
      <OfferControls choice={choice} terms={terms} onChange={setChoice} />
      <div aria-live="polite" aria-atomic="true">
        <Facts
          facts={[
            [OFFER_TEXT.fee, fee === null ? OFFER_TEXT.noFee : TEXT.card.money(fee, currency)],
            [
              OFFER_TEXT.wage,
              wage === null
                ? OFFER_TEXT.never
                : OFFER_TEXT.wageValue(TEXT.card.money(wage, currency), TEXT.years(years)),
            ],
            ...(bonus === 0
              ? []
              : [[OFFER_TEXT.bonusAmount, TEXT.card.money(bonus, currency)] as const]),
          ]}
        />
        {terms.feeOverCap ? <p className="help">{OFFER_TEXT.feeOverCap}</p> : null}
        {terms.wageOverCap ? <p className="help">{OFFER_TEXT.wageOverCap}</p> : null}
      </div>
      {player.saleRefusal === null ? null : (
        <p className="help">{OFFER_TEXT.refusals[player.saleRefusal]}</p>
      )}
    </section>
  );
};
