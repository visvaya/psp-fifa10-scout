// The offer form's estimate of a free agent's value once he signs (owner, 2026-11-09), rendered to HTML.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
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

const offerHtml = (signedValuesEuro: readonly number[] | null): string =>
  renderToStaticMarkup(
    <OfferFacts
      // id 2 asks for a three-year contract, (id % 5) + 1, which the form starts with.
      player={testPlayer({ id: 2, price: 0, wage: 900, freeAgent: true, signedValuesEuro })}
      context={CONTEXT}
      currency={0}
    />,
  );

describe("the offer form's value of a free agent once signed", () => {
  it("shows the value for the contract the form starts with", () => {
    const html = offerHtml([100_000, 200_000, 300_000, 400_000, 500_000]);
    expect(html).toContain(OFFER_TEXT.signedValue);
    expect(html).toContain(TEXT.card.money(300_000, 0));
  });

  it("shows nothing for a player who is no free agent", () => {
    expect(offerHtml(null)).not.toContain(OFFER_TEXT.signedValue);
  });
});
