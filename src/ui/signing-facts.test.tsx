import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { SigningFacts } from "./signing-facts.tsx";

const BEFORE = testPlayer({ overall: 84, potential: 84, peak: 84, price: 1_000_000 });
const AFTER = testPlayer({ overall: 87, potential: 89, peak: 89, price: 1_400_000 });

const text = (html: string) => html.replaceAll(/<[^>]*>/gu, "");

describe("the card's section on signing", () => {
  it("pairs each value that changes, the arrow in words for screen readers", () => {
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={AFTER} showPotential currency={0} />,
    );
    expect(html).toContain("Po podpisaniu");
    expect(text(html)).toContain("84 przed podpisaniem, → 87 po podpisaniu");
    expect(text(html)).toContain("Potencjał");
    expect(text(html)).toContain("Cena");
  });

  it("leaves out the potential's values while the potential is hidden", () => {
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={AFTER} showPotential={false} currency={null} />,
    );
    expect(text(html)).toContain("OVR");
    expect(text(html)).not.toContain("Potencjał");
    expect(text(html)).not.toContain("Cena");
  });

  it("shows nothing when signing changes nothing", () => {
    expect(
      renderToStaticMarkup(
        <SigningFacts before={BEFORE} after={BEFORE} showPotential currency={0} />,
      ),
    ).toBe("");
  });
});
