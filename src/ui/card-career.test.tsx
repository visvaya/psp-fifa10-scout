import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { CareerFacts } from "./card-career.tsx";

const render = (overrides: Parameters<typeof testPlayer>[0], showPotential = true) =>
  renderToStaticMarkup(
    <CareerFacts player={testPlayer(overrides)} showPotential={showPotential} />,
  );

// Roadmap 36: the experience bar of the user's squad, with the matches to its level-up as a range.
describe("the card's experience bar", () => {
  it("shows the bar out of 1000, the matches to the level-up and the points it gives", () => {
    const html = render({ levelUpXp: 640, levelUpPoints: 3, overall: 70, potential: 80 });
    expect(html).toMatch(/<dd>640.z.1000, awans za 7–24.mecze<\/dd>/u);
    expect(html).toMatch(/awansie<button.*<dd>3<\/dd>/u);
  });

  it("says a full bar levels up after the next match, and a capped OVR gets no points", () => {
    const html = render({ levelUpXp: 1000, levelUpPoints: 0, overall: 80, potential: 80 });
    expect(html).toMatch(/1000.z.1000, awans po najbliższym meczu/u);
    expect(html).toMatch(/<dd>0 \(OVR osiągnął potencjał, więc awans nie doda punktów\)<\/dd>/u);
  });

  // CodeRabbit on #201: the reason names the potential, which stays hidden while the potential does.
  it("leaves the reason out while the potential is hidden", () => {
    const html = render({ levelUpXp: 400, levelUpPoints: 0, overall: 80, potential: 80 }, false);
    expect(html).toMatch(/awansie<button.*<dd>0<\/dd>/u);
    expect(html).not.toContain("potencjał, więc");
  });

  it("names one count of matches when the range closes", () => {
    expect(render({ levelUpXp: 990, levelUpPoints: 0 })).toMatch(/awans za 1.mecz</u);
  });

  it("shows no bar outside the user's squad", () => {
    expect(render({ levelUpXp: null, levelUpPoints: null })).not.toContain("Doświadczenie");
  });
});
