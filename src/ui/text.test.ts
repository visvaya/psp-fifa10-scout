import { describe, expect, it } from "vitest";
import { formatNumber, plural, TEXT } from "./text.ts";

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

describe("TEXT.resultCount", () => {
  it("joins the formatted count and the plural form", () => {
    expect(TEXT.resultCount(1)).toBe("1 zawodnik");
    expect(TEXT.resultCount(13_045)).toBe("13 045 zawodników");
  });
});
