import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { chipText, namesById } from "./chip-text.ts";

const names = {
  positionName: (code: number) => ["BR", "ST (ang. SW)"][code] ?? `P${String(code)}`,
  byId: namesById([
    testPlayer({ id: 1, nationalityId: 52, nationalityName: "Argentina", clubId: 21 }),
    testPlayer({ id: 2, nationalityId: 37, nationalityName: "Poland", clubId: null }),
  ]),
};

describe("chipText", () => {
  it("gives a range its bounds", () => {
    const filters = {
      ranges: { overall: { min: 70, max: 80 }, age: { max: 21 }, sprintspeed: { min: 90 } },
    };
    expect(chipText("ranges.overall", filters, names)).toBe("OVR: od 70 do 80");
    expect(chipText("ranges.age", filters, names)).toBe("Wiek: do 21");
    expect(chipText("ranges.sprintspeed", filters, names)).toBe("Szybkość: od 90");
  });

  it("names the peak ranges for the best position while peakAtBest is on", () => {
    const ranges = { peak: { min: 80 }, peakGain: { max: 3 } };
    expect(chipText("ranges.peak", { ranges }, names)).toBe("Szczyt OVR: od 80");
    const atBest = { ranges, peakAtBest: true };
    expect(chipText("ranges.peak", atBest, names)).toBe("Szczyt OVR na najlepszej pozycji: od 80");
    expect(chipText("ranges.peakGain", atBest, names)).toBe(
      "Zapas do szczytu na najlepszej pozycji: do 3",
    );
    expect(
      chipText("ranges.overall", { ranges: { overall: { min: 70 } }, peakAtBest: true }, names),
    ).toBe("OVR: od 70");
  });

  it("names the chosen values, and counts those past the first three", () => {
    const filters = {
      lists: {
        nationalityId: [52, 37],
        positionCode: [0, 1, 2, 3, 4],
        preferredFoot: ["left" as const],
        positionGroup: ["sweeper" as const],
        bodyType: [3],
        leagueId: [99],
      },
    };
    expect(chipText("lists.nationalityId", filters, names)).toBe("Narodowość: Argentina, Poland");
    expect(chipText("lists.positionCode", filters, names)).toBe(
      "Pozycje szczegółowe: BR, ST (ang. SW), P2 +2",
    );
    expect(chipText("lists.preferredFoot", filters, names)).toBe("Lepsza noga: lewa");
    expect(chipText("lists.positionGroup", filters, names)).toBe("Pozycje: Libero");
    expect(chipText("lists.bodyType", filters, names)).toBe("Typ budowy: typ 3");
    const development = { lists: { developmentType: [3], developmentStyle: [5, 9] } };
    expect(chipText("lists.developmentType", development, names)).toBe("Typ rozwoju: późny");
    expect(chipText("lists.developmentStyle", development, names)).toBe(
      "Styl rozwoju: nagły skok, styl 9",
    );
    // An id no player carries shows as the number.
    expect(chipText("lists.leagueId", filters, names)).toBe("Liga: 99");
  });

  it("gives the position rating its position, bounds, gain and peak", () => {
    expect(
      chipText("positionRating", { positionRating: { code: 0, min: 70, gain: { min: 1 } } }, names),
    ).toBe("Ocena na pozycji: BR, od 70, różnica od +1");
    const peak = { positionRating: { code: 0, gain: { max: 3 }, peak: { min: 80, max: 85 } } };
    expect(chipText("positionRating", peak, names)).toBe(
      "Ocena na pozycji: BR, różnica do +3, szczyt od 80 do 85",
    );
    expect(chipText("positionRating", { positionRating: { code: 0, bestOnly: true } }, names)).toBe(
      "Ocena na pozycji: BR, najlepsza pozycja",
    );
    expect(chipText("positionRating", { positionRating: { code: 0 } }, names)).toBe(
      "Ocena na pozycji: BR",
    );
  });

  it("gives the name searched for, yes or no for a trait, and the chosen option", () => {
    expect(chipText("text", { text: "messi" }, names)).toBe("Nazwisko: messi");
    expect(chipText("flags.injuryprone", { flags: { injuryprone: false } }, names)).toBe(
      "Podatny na kontuzje: nie",
    );
    expect(chipText("myClub", { myClub: "hide" }, names)).toBe("Ukryj zawodników mojego klubu");
    expect(chipText("clubStatus", { clubStatus: "free-agents" }, names)).toBe(
      "Tylko wolni zawodnicy",
    );
  });
});
