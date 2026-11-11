import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { SigningFacts } from "./signing-facts.tsx";

const BEFORE = testPlayer({ overall: 84, potential: 84, peak: 84 });
const AFTER = testPlayer({ overall: 87, potential: 89, peak: 89 });

describe("the card's section on signing", () => {
  it("pairs each value that changes, the arrow in words for screen readers", () => {
    const html = renderToStaticMarkup(<SigningFacts before={BEFORE} after={AFTER} showPotential />);
    expect(html).toContain("Po podpisaniu");
    expect(html).toMatch(/84.*przed podpisaniem,.*→.*87.*po podpisaniu/u);
    expect(html).toContain("Potencjał");
  });

  it("leaves out the potential's values while the potential is hidden", () => {
    const html = renderToStaticMarkup(
      <SigningFacts before={BEFORE} after={AFTER} showPotential={false} />,
    );
    expect(html).toContain("OVR");
    expect(html).not.toContain("Potencjał");
  });

  it("shows nothing when signing changes nothing", () => {
    expect(
      renderToStaticMarkup(<SigningFacts before={BEFORE} after={BEFORE} showPotential />),
    ).toBe("");
  });
});
