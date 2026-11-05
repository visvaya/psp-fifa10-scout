import { describe, expect, it } from "vitest";
import { decimalText } from "./decimal-text.ts";

describe("decimalText", () => {
  it.each([
    ["6.5", "6,5", 6.5],
    ["6,5", "6,5", 6.5],
    ["6.", "6,", 6],
    ["6,5.", "6,5", 6.5],
    ["a6b,c5", "6,5", 6.5],
    ["", "", undefined],
    [",", ",", undefined],
  ])("turns %j into %j worth %j", (typed, text, value) => {
    expect(decimalText(typed, ",")).toEqual({ text, value });
  });

  it("writes the separator the language uses", () => {
    expect(decimalText("6,5", ".")).toEqual({ text: "6.5", value: 6.5 });
  });
});
