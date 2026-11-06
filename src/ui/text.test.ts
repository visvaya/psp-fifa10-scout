import { describe, expect, it } from "vitest";
import { formatNumber, formatRating, plural, TEXT } from "./text.ts";
import { OFFER_TEXT } from "./text-offer.ts";

const LAT = { one: "rok", few: "lata", many: "lat" } as const;

describe("plural", () => {
  it.each([
    [0, "lat"],
    [1, "rok"],
    [2, "lata"],
    [4, "lata"],
    [5, "lat"],
    [12, "lat"],
    [14, "lat"],
    [21, "lat"],
    [22, "lata"],
    [25, "lat"],
    [112, "lat"],
    [122, "lata"],
  ])("%d takes %s", (count, form) => {
    expect(plural(count, LAT)).toBe(form);
  });
});

describe("formatNumber", () => {
  it("groups from five digits with a non-breaking space, as Polish style wants", () => {
    expect(formatNumber(1500)).toBe("1500");
    expect(formatNumber(26_090)).toBe("26 090");
  });
});

// A match rating with one decimal, as the game's stats screen shows it.
describe("formatRating", () => {
  it.each([
    [6.9, "6,9"],
    [7, "7,0"],
  ])("shows %d as %s", (value, text) => {
    expect(formatRating(value)).toBe(text);
  });
});

describe("TEXT.resultCount", () => {
  it("joins the formatted count and the plural form", () => {
    expect(TEXT.resultCount(1)).toBe("1 zawodnik");
    expect(TEXT.resultCount(13_045)).toBe("13 045 zawodników");
  });
});

describe("TEXT.card money", () => {
  it("labels a wage in the save's currency as an estimate", () => {
    expect(TEXT.card.wageEstimate(4500, 0)).toBe("4500 € (szacunek)");
    expect(TEXT.card.wageEstimate(10_000, 2)).toBe(`${formatNumber(10_000)} $ (szacunek)`);
  });

  it("shows money with the currency symbol", () => {
    expect(TEXT.card.money(33_000_000, 1)).toBe(`${formatNumber(33_000_000)} £`);
  });
});

describe("OFFER_TEXT options", () => {
  it("names a bonus by its share of the wage", () => {
    expect(OFFER_TEXT.bonusOption(0)).toBe("0% zarobków");
    expect(OFFER_TEXT.bonusOption(15)).toBe("15% zarobków");
  });

  it("marks the contract length the player wants", () => {
    expect(OFFER_TEXT.lengthOption("4 lata", true)).toBe("4 lata, tyle chce zawodnik");
    expect(OFFER_TEXT.lengthOption("3 lata", false)).toBe("3 lata");
  });
});
