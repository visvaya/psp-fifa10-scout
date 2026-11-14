import { afterEach, describe, expect, it, vi } from "vitest";
import { decimalSeparator, formatNumber, formatRating, plural, rangeLabel, TEXT } from "./text.ts";
import { CHART_READING_TEXT } from "./text-chart-reading.ts";
import { OFFER_TEXT } from "./text-offer.ts";
import { TEST_CAREER } from "../logic/test-support/player-fixtures.ts";
import { NBSP } from "./typeset.ts";

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
  it("names the market wage an estimate in its label, the same on the card as in filters", () => {
    expect(TEXT.card.wage).toBe("Zarobki rynkowe (szacunkowe)");
    expect(TEXT.card.wage).toBe(rangeLabel("wage"));
  });

  it("shows money with the currency symbol", () => {
    expect(TEXT.card.money(33_000_000, 1)).toBe(`${formatNumber(33_000_000)} £`);
  });
});

describe("the development chart's texts", () => {
  it("names each mark of the legend once, with ages in years", () => {
    expect(TEXT.card.legendNow(22, "przed szczytem", null)).toBe(
      `wiek w${NBSP}tym sezonie: 22${NBSP}lata, przed szczytem`,
    );
    expect(TEXT.card.legendNow(22, "przed szczytem", 61)).toBe(
      `wiek w${NBSP}tym sezonie: 22${NBSP}lata, przed szczytem, OVR 61`,
    );
    expect(TEXT.card.legendPlateau(26, 29)).toBe(`okres szczytu: 26–29${NBSP}lat`);
    expect(TEXT.card.legendPlateau(27, 27)).toBe(`okres szczytu: 27${NBSP}lat`);
    expect(TEXT.card.legendPeak(27, 80, true)).toBe(`szczyt: 27${NBSP}lat, OVR 80`);
    expect(TEXT.card.legendPeak(27, 80, false)).toBe(`szczyt: 27${NBSP}lat, poziom 80`);
  });

  // Owner, 2026-11-14 (roadmaps 124, 127): a short legend; why the chart's age differs from the
  // retirement age on the card goes behind its "?".
  it("names the last season shortly and explains the two ages behind its help", () => {
    expect(CHART_READING_TEXT.legendRetirement(32)).toBe(`ostatni sezon: 32${NBSP}lata`);
    expect(CHART_READING_TEXT.retirementHelp(34)).toContain(
      `kariery z${NBSP}bazy, 34${NBSP}lata, gra`,
    );
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

describe("TEXT.careerLoaded", () => {
  const career = { ...TEST_CAREER, managerName: "Ann Kariera", clubName: "Club" };

  it("names the last game, or says none was played yet", () => {
    const last = new Date(Date.UTC(2009, 6, 25));
    expect(TEXT.careerLoaded({ ...career, lastGameDate: last })).toMatch(
      /^Kariera: Ann Kariera, Club, ostatni mecz .*2009$/,
    );
    expect(TEXT.careerLoaded({ ...career, lastGameDate: null })).toBe(
      "Kariera: Ann Kariera, Club, przed pierwszym meczem",
    );
  });
});

describe("the number and date formats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Building an Intl object loads its locale data: a long task at the start of a slow phone.
  it("are made on first use, not while the module loads", async () => {
    const spies = (["DateTimeFormat", "NumberFormat", "PluralRules"] as const).map((name) =>
      vi.spyOn(Intl, name),
    );
    vi.resetModules();
    await import("./text.ts");
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it("type decimals with the Polish comma", () => {
    expect(decimalSeparator()).toBe(",");
  });
});
