import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { columnText } from "./player-list.tsx";

describe("a missing value in the list", () => {
  it("shows a dash in every kind of column, a zero as a zero", () => {
    const player = testPlayer({
      goals: null,
      assists: 0,
      price: null,
      leagueName: null,
      peak: null,
    });
    expect(columnText(player, "goals", null)).toBe("–");
    expect(columnText(player, "assists", null)).toBe("0");
    expect(columnText(player, "price", null)).toBe("–");
    expect(columnText(player, "leagueName", null)).toBe("–");
    expect(columnText(player, "peak", null)).toBe("–");
    expect(columnText(player, "positionPeak", null)).toBe("–");
  });
});
