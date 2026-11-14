import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { SigningFacts } from "./signing-facts.tsx";

/** The profile after a transfer alone. */
const SIGNING = { afterSigning: true, atPeak: false } as const;

const BEFORE = testPlayer({ overall: 84, potential: 84, peak: 84, price: 900_000, wage: 4000 });
const AFTER = testPlayer({ overall: 87, potential: 89, peak: 89, price: 2_000_000, wage: 6000 });

describe("the card's section on the transfer", () => {
  it("pairs each value that changes, the arrow in words for screen readers", () => {
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={AFTER} showPotential currency={0} profile={SIGNING} />,
    );
    expect(html).toContain("Po transferze");
    expect(html).toMatch(/84.*przed transferem,.*→.*87.*po transferze/u);
    expect(html).toContain("Potencjał");
  });

  it("leaves out the potential's values while the potential is hidden", () => {
    const html = renderToStaticMarkup(
      <SigningFacts
        before={BEFORE}
        after={AFTER}
        showPotential={false}
        currency={0}
        profile={SIGNING}
      />,
    );
    expect(html).toContain("OVR");
    expect(html).not.toContain("Potencjał");
  });

  it("shows nothing while the profile after a transfer is off", () => {
    expect(
      renderToStaticMarkup(
        <SigningFacts
          before={BEFORE}
          after={BEFORE}
          showPotential
          currency={0}
          profile={SIGNING}
        />,
      ),
    ).toBe("");
  });

  // Owner, 2026-11-14 (roadmap 56(c)): on the card his price at the user's club for any contract of 1
  // to 5 years, and his wage there.
  it("pairs his price with its range for 1 to 5 years and his wage with the one at the user's club", () => {
    const signed = {
      ...AFTER,
      signedValuesEuro: [1_000_000, 2_000_000, 3_000_000, 2_500_000, 1_500_000],
      signedWageEuro: 6000,
      transferWage: 9500,
    };
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={signed} showPotential currency={0} profile={SIGNING} />,
    );
    expect(html).toContain("Cena (kontrakt 1–5");
    expect(html).toMatch(/900.000.*→.*1.000.000.*3.000.000/u);
    expect(html).toMatch(/4000.€.*→.*6000.€/u);
    expect(html).toMatch(/Pensja po .*9500.€/u);
  });

  it("leaves the money out for a player without values at the user's club", () => {
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={AFTER} showPotential currency={0} profile={SIGNING} />,
    );
    expect(html).not.toContain("Cena (kontrakt");
  });

  // Owner, 2026-11-14 (roadmap 123): the profile at the peak names its section and pairs the age.
  it("names the profile at the peak and pairs today's age with the peak's", () => {
    const html = renderToStaticMarkup(
      <SigningFacts
        before={{ ...BEFORE, age: 21 }}
        after={{ ...AFTER, age: 24 }}
        showPotential
        currency={0}
        profile={{ afterSigning: false, atPeak: true }}
      />,
    );
    expect(html).toContain("W szczycie</h3>");
    expect(html).toMatch(/21.lat.*dziś,.*→.*24.lata.*w.szczycie/u);
  });
});
