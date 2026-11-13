import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { columnLabel, columnText } from "./player-list.tsx";
import { FLAG_LABELS } from "./text.ts";

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

    // A player outside the club has no state, role or target.
    for (const key of ["squadState", "role", "target", "peakTarget"] as const) {
      expect(columnText(player, key, null)).toBe("–");
    }
    expect(columnText(testPlayer({ squadState: "toSell", roleName: "3. ST" }), "role", null)).toBe(
      "3. ST",
    );
  });
});

describe("a yes / no value in the list", () => {
  it("reads yes or no under the filter's name, a dash where a career does not tell", () => {
    const player = testPlayer({ traits: ["leadership"], loanedFromId: null, clubWillSell: null });
    expect(columnLabel("leadership")).toBe(FLAG_LABELS.leadership);
    expect(columnText(player, "leadership", null)).toBe("tak");
    expect(columnText(player, "diver", null)).toBe("nie");
    expect(columnText(player, "loaned", null)).toBe("nie");
    expect(columnText(player, "clubWillSell", null)).toBe("–");
  });
});

describe("a list's value in the list", () => {
  it("names it as the filter does, not by its code", () => {
    const player = testPlayer({
      positionGroup: "centre-backs",
      preferredFoot: "left",
      developmentType: 3,
      developmentStyle: 2,
    });
    expect(columnText(player, "positionGroup", null)).toBe("Środkowy obrońca");
    expect(columnText(player, "preferredFoot", null)).toBe("lewa");
    expect(columnText(player, "developmentType", null)).toBe("późny");
    expect(columnText(player, "developmentStyle", null)).toBe("dobry");
  });
});
