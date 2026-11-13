import { describe, expect, it } from "vitest";
import {
  composedPortraitOf,
  lookDifferences,
  nearestComposedPortrait,
  realPortraitOf,
} from "./portraits.ts";
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

describe("the nearest composed portrait", () => {
  // Face 005 with hair 03, beard 1, colour 2; the pack lacks it.
  const wanted = "g_0050312";

  it("keeps the face and prefers the same hair, then hair colour, then facial hair", () => {
    const pack = ["g_0060312", "g_0050401", "g_0050421", "g_0050302", "g_0050311"];
    expect(nearestComposedPortrait(wanted, pack)).toBe("g_0050302");
    expect(nearestComposedPortrait(wanted, ["g_0050401", "g_0050311"])).toBe("g_0050311");
    expect(nearestComposedPortrait(wanted, ["g_0050401", "g_0050412"])).toBe("g_0050412");
    expect(nearestComposedPortrait(wanted, ["g_0050411", "g_0050402"])).toBe("g_0050402");
  });

  it("breaks a tie by the lowest name and finds none without the same face", () => {
    expect(nearestComposedPortrait(wanted, ["g_0050901", "g_0050801"])).toBe("g_0050801");
    expect(nearestComposedPortrait(wanted, ["g_0060312", "g_1050312"])).toBeNull();
    expect(nearestComposedPortrait(wanted, [])).toBeNull();
  });

  it("names what differs from his own, in the order hair, hair colour, facial hair", () => {
    expect(lookDifferences(wanted, "g_0050401")).toEqual(["hair", "hairColor", "facialHair"]);
    expect(lookDifferences(wanted, "g_0050311")).toEqual(["hairColor"]);
    expect(lookDifferences(wanted, "g_0050302")).toEqual(["facialHair"]);
    expect(lookDifferences(wanted, wanted)).toEqual([]);
  });
});
