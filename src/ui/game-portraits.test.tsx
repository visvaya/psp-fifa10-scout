// Portraits and kits with a synthetic pack, and without one: what holds their place before the images
// arrive (the effects that bring them do not run in a static render).
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { GraphicsPack } from "../data/game-graphics.ts";
import { buildShpm, refpackLiterals } from "../data/test-support/synthetic-graphics.ts";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { GameImages, kitsOf, portraitOf, PortraitSlot } from "./game-image.tsx";
import { PlayerCard } from "./player-card.tsx";
import type { PositionNames } from "./position-name.tsx";

const image = refpackLiterals(buildShpm(1, 1, [0], [[1, 2, 3, 255]]));
const NAMES = ["s_00000007", "g_5011203", "tl1873", "j0_01873"];
const pack: GraphicsPack = {
  bytes: Uint8Array.from(NAMES.flatMap(() => [...image])),
  entries: NAMES.map((name, index) => [name, index * image.length, image.length] as const),
};

const POSITIONS: PositionNames = {
  short: () => "ŚP",
  abbreviation: () => "ŚP",
  full: () => undefined,
};

const withPack = (graphics: GraphicsPack | null, children: ReactNode): string =>
  renderToStaticMarkup(<GameImages pack={graphics}>{children}</GameImages>);

const card = (graphics: GraphicsPack | null, overrides: Parameters<typeof testPlayer>[0]) => {
  const player = testPlayer(overrides);
  return withPack(
    graphics,
    <PlayerCard
      player={player}
      career={false}
      currency={null}
      curves={new Map()}
      offer={null}
      offerPlayer={player}
      showPotential={false}
      names={POSITIONS}
      watched={false}
      note={undefined}
      dispatch={() => undefined}
      onClose={() => undefined}
    />,
  );
};

/** The list's slot of a player with this composed portrait and no real one. */
const slot = (id: number, composedPortrait: string) =>
  withPack(pack, <PortraitSlot player={testPlayer({ id, composedPortrait })} />);

const PORTRAIT = '<span class="game-image portrait" aria-hidden="true"></span>';

describe("the names of portraits and kits", () => {
  it("try the real portrait first, then the composed one", () => {
    expect(portraitOf(testPlayer({ id: 7, composedPortrait: "g_0050312" }))).toEqual({
      names: ["s_00000007", "g_0050312"],
      shape: "portrait",
    });
  });

  it("pad the club id of a kit to at least five digits, and give none without a club", () => {
    expect(kitsOf(1873).map(({ names }) => names)).toEqual([["j0_01873"], ["j1_01873"]]);
    expect(kitsOf(111_091).map(({ names }) => names)).toEqual([["j0_111091"], ["j1_111091"]]);
    expect(kitsOf(null)).toEqual([]);
  });
});

describe("the card", () => {
  it("shows the portrait at the top and the kits the game has after the club", () => {
    const html = card(pack, { id: 7, clubId: 1873 });
    expect(html).toContain(`<div class="card-portrait">${PORTRAIT}</div>`);
    expect(html.match(/game-image kit/gu)).toHaveLength(1);
  });

  it("keeps the neutral box for a player the game has no portrait of, and no kit without a club", () => {
    const html = card(pack, { id: 8, composedPortrait: "g_9999999", clubId: null });
    expect(html).toContain('<div class="card-portrait"></div>');
    expect(html).not.toContain("game-image kit");
  });

  it("shows neither without the game's graphics", () => {
    const html = card(null, { id: 7, clubId: 1873 });
    expect(html).not.toContain("card-portrait");
    expect(html).not.toContain("game-image");
  });
});

describe("the list's portrait slot", () => {
  it("holds the composed portrait when there is no real one, and stays empty without either", () => {
    expect(slot(9, "g_5011203")).toBe(`<span class="portrait-slot">${PORTRAIT}</span>`);
    expect(slot(9, "g_9999999")).toBe('<span class="portrait-slot"></span>');
  });

  it("is not there without the game's graphics", () => {
    expect(withPack(null, <PortraitSlot player={testPlayer({ id: 7 })} />)).toBe("");
  });
});
