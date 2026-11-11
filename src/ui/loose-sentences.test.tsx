// Explanations stay behind a "?" or a "!" (field-help.tsx, texts in text-help.ts) rather than as plain
// text on the card and its offer form (owner, 2026-11-07). The card is rendered to HTML in the state
// below, the panels' texts are taken out, and no text left may read as a sentence.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import type { PositionNames } from "./position-name.tsx";
import { PlayerCard } from "./player-card.tsx";
import { WARNING_TEXT } from "./text-help.ts";
import { OFFER_TEXT } from "./text-offer.ts";

/**
 * A sentence: a text of four words or more ending with a full stop or a question mark. Labels, values
 * and abbreviations ("Poz.") end without one or are shorter.
 */
const SENTENCE = /^\S+(?:\s+\S+){3,}[.?]$/u;

/**
 * Texts that may stay in sight: a refusal says no offer can succeed, an outcome rather than an
 * explanation, so it is not hidden behind a mark.
 */
const STATUS_TEXTS: ReadonlySet<string> = new Set(Object.values(OFFER_TEXT.refusals));

const ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
};

/** The texts an HTML fragment shows outside the "?" and "!" panels, adjacent text nodes joined. */
const looseTexts = (html: string): readonly string[] =>
  html
    .replaceAll(/<span[^>]*class="field-help-panel"[^>]*>[^<]*<\/span>/gu, "<span></span>")
    .replaceAll("<!-- -->", "")
    .split(/<[^>]+>/u)
    .map((text) =>
      text.replaceAll(/&(?:amp|lt|gt|quot|#x27);/gu, (entity) => ENTITIES[entity] ?? entity).trim(),
    )
    .filter((text) => text !== "");

const NAMES: PositionNames = {
  short: (code) => `P${String(code)}`,
  abbreviation: (code) => `P${String(code)}`,
  full: () => undefined,
};

// The state rendered: a career offer with its default choices, potential shown, the peak below the
// potential, a fee and a wage above the form's limit, a refusal, the game's shortlist, the own list, a
// note, and a flat curve. The double offer checked is not rendered.
const player = testPlayer({
  id: 6,
  birthYear: 1986,
  overall: 90,
  potential: 95,
  peak: 90,
  price: 100_001,
  wage: 3000,
  shortlisted: true,
  saleRefusal: "squad",
});

const html = renderToStaticMarkup(
  <PlayerCard
    player={player}
    career
    currency={0}
    curves={new Map([[1, Array.from({ length: 31 }, () => 50)]])}
    offer={{ prestige: 0, negotiator: 0, squadAverage: 65, countryId: 37, seasonEndYear: 2010 }}
    offerPlayer={player}
    showPotential
    names={NAMES}
    watched
    note={{ playerId: 1, text: "Szybki", name: null, changedAt: "2026-11-10T21:31:05.000Z" }}
    dispatch={() => undefined}
    onClose={() => undefined}
  />,
);

describe("explanations on the card", () => {
  it("renders the offer form and its conditional texts", () => {
    expect(html).toContain('id="offer-title"');
    for (const text of [
      WARNING_TEXT.peakBelowPotential(player.potential),
      WARNING_TEXT.feeOverCap,
      WARNING_TEXT.wageOverCap,
      OFFER_TEXT.refusals.squad,
    ]) {
      expect(html).toContain(text);
    }
  });

  it('shows no sentence outside a "?" or "!" panel', () => {
    const sentences = looseTexts(html).filter(
      (text) => SENTENCE.test(text) && !STATUS_TEXTS.has(text),
    );
    expect(
      sentences,
      'Move each explanation to text-help.ts and show it behind a "?" (FieldHelp) or a "!" (WarnedValue).',
    ).toEqual([]);
  });
});
