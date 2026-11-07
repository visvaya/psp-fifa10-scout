import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { abbreviationIn, positionNameIn } from "../logic/game-names.ts";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { bestPeak } from "./player-card.tsx";
import type { PositionNames } from "./position-name.tsx";

// Polish "ST" names the sweeper (code 1), which English "ST" calls the striker.
const polish = { teams: {}, leagues: {}, countries: {}, positions: { 1: "ST" }, positionNames: {} };
const names: PositionNames = {
  short: (code) => positionNameIn(polish, code),
  abbreviation: (code) => abbreviationIn(polish, code),
  full: () => undefined,
};

const html = (player: ReturnType<typeof testPlayer>, showPotential = true): string =>
  renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      ...bestPeak(player, showPotential, names).map(([, value]) => value),
    ),
  );

describe("the card's best peak row", () => {
  const sweeper = testPlayer({
    peak: 60,
    bestPeak: 70,
    bestPeakCode: 1,
    bestPeakName: "ST",
    bestPeakGain: 5,
  });

  it("names a misleading position with its English name, as the position row does", () => {
    expect(html(sweeper)).toContain("ST (ang. SW)");
  });

  it("names the other positions with the same peak under it, and none when no other ties", () => {
    // RS, ST and LS peak at 70; the card names RS.
    const peakByCode = Array.from({ length: 32 }, (_, code) => (code >= 29 ? 70 : 60));
    const striker = { ...sweeper, peakByCode, bestPeakCode: 29, bestPeakName: "RS" };
    expect(bestPeak(striker, true, names)[0]?.[3]).toBe("ten sam szczyt także na: ST, LS");
    expect(bestPeak({ ...sweeper, peakByCode: [60, 70] }, true, names)[0]?.[3]).toBeUndefined();
  });

  it("has no row without potential, without a career or when the preferred position peaks as high", () => {
    expect(bestPeak(sweeper, false, names)).toEqual([]);
    expect(bestPeak(testPlayer(), true, names)).toEqual([]);
    expect(bestPeak({ ...sweeper, bestPeak: 60 }, true, names)).toEqual([]);
  });
});
