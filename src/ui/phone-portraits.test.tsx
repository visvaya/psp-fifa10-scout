// The phone rows show portraits only on the basic list, the name and the rating column (owner,
// 2026-11-13): with any further column the name needs the room. The browser tests load no game
// graphics, so the rule is checked here on a static render.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GraphicsPack } from "../data/game-graphics.ts";
import { buildShpm, refpackLiterals } from "../data/test-support/synthetic-graphics.ts";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import type { SortKey } from "../logic/sort-players.ts";
import { GameImages } from "./game-image.tsx";
import { PhoneRow } from "./player-rows.tsx";

const image = refpackLiterals(buildShpm(1, 1, [0], [[1, 2, 3, 255]]));
const pack: GraphicsPack = { bytes: image, entries: [["s_00000007", 0, image.length]] };

const row = (columns: readonly SortKey[]): string =>
  renderToStaticMarkup(
    <GameImages pack={pack}>
      <PhoneRow
        player={testPlayer({ id: 7 })}
        watched={false}
        columns={columns}
        labels={columns.map(String)}
        ratingCode={null}
        dispatch={() => undefined}
      />
    </GameImages>,
  );

describe("the phone row's portrait", () => {
  it("shows on the basic list", () => {
    expect(row(["overall"])).toContain('class="portrait-slot"');
  });

  it("is not there once the list shows a further column", () => {
    expect(row(["overall", "potential"])).not.toContain("portrait-slot");
    expect(row(["overall", "age"])).not.toContain("portrait-slot");
  });
});
