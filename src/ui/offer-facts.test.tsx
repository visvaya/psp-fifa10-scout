// The offer form's estimate of a free agent's value once he signs (owner, 2026-11-09), rendered to HTML.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CurrencyCode } from "../data/career-save.ts";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { roundPrice } from "../logic/transfer-price.ts";
import { OfferFacts } from "./offer-facts.tsx";
import { TEXT } from "./text.ts";
import { OFFER_TEXT } from "./text-offer.ts";

const CONTEXT = {
  prestige: 0,
  negotiator: 0,
  squadAverage: 65,
  countryId: 37,
  seasonEndYear: 2010,
} as const;

/** A distinct value for each contract length, 1 to 5 years. */
const VALUES = [100_000, 200_000, 300_000, 400_000, 500_000] as const;

/**
 * The form for a free agent: the contract it starts with is the one he asks for, (id % 5) + 1 years,
 * so id 2 starts at three years and id 5 at one.
 */
const offerHtml = (
  signedValuesEuro: readonly number[] | null,
  { id = 2, currency = 0 }: { id?: number; currency?: CurrencyCode } = {},
): string =>
  renderToStaticMarkup(
    <OfferFacts
      player={testPlayer({ id, price: 0, wage: 900, freeAgent: true, signedValuesEuro })}
      context={CONTEXT}
      currency={currency}
    />,
  );

describe("the offer form's value of a free agent once signed", () => {
  it("shows the value for the contract length the form has chosen", () => {
    const threeYears = offerHtml(VALUES);
    expect(threeYears).toContain(OFFER_TEXT.signedValue);
    expect(threeYears).toContain(TEXT.card.money(300_000, 0));
    // Another length, another value: the form does not keep the three years' estimate.
    expect(offerHtml(VALUES, { id: 5 })).toContain(TEXT.card.money(100_000, 0));
  });

  it("shows the value in the list's currency", () => {
    expect(offerHtml(VALUES, { currency: 1 })).toContain(
      TEXT.card.money(roundPrice(300_000 * 0.86), 1),
    );
  });

  it("shows nothing for a player who is no free agent", () => {
    expect(offerHtml(null)).not.toContain(OFFER_TEXT.signedValue);
  });
});
