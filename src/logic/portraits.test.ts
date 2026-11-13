import { describe, expect, it } from "vitest";
import { composedPortraitOf, realPortraitOf } from "./portraits.ts";
import { playerRow } from "./test-support/player-fixtures.ts";

/** The composed portrait of a row with these face columns. */
const face = (facetypeid: number, hairtypeid: number, beard: number, colour: number) =>
  composedPortraitOf(
    playerRow({ facetypeid, hairtypeid, facialhairstyleid: beard, haircolorid: colour }),
  );

describe("the game's portrait names", () => {
  it("compose a face from its type, hair, facial hair and hair colour, zero-padded", () => {
    expect(face(5, 3, 1, 2)).toBe("g_0050312");
    expect(face(123, 45, 6, 7)).toBe("g_1234567");
    expect(face(0, 0, 0, 0)).toBe("g_0000000");
  });

  it("name a real portrait by the player id in eight digits", () => {
    expect(realPortraitOf(1)).toBe("s_00000001");
    expect(realPortraitOf(12_345_678)).toBe("s_12345678");
  });
});
