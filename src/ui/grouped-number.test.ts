import { describe, expect, it } from "vitest";
import { caretAfterDigits, digitsBefore, groupedValue } from "./grouped-number.ts";

const NBSP = " ";

describe("grouped numbers", () => {
  it("reads the typed digits, whatever separates them", () => {
    expect(groupedValue(`1${NBSP}000${NBSP}000`)).toBe(1_000_000);
    expect(groupedValue("2 500 €")).toBe(2500);
    expect(groupedValue("0")).toBe(0);
    expect(groupedValue(` ${NBSP}x`)).toBeUndefined();
  });

  it("keeps the caret after the same digit once the number is regrouped", () => {
    // Typed "10000|0" (caret before the last digit) becomes "100 000": the caret stays after 5 digits.
    const typed = "100000";
    const digits = digitsBefore(typed, 5);
    expect(digits).toBe(5);
    expect(caretAfterDigits(`100${NBSP}000`, digits)).toBe(6);
    expect(caretAfterDigits(`100${NBSP}000`, 3)).toBe(3);
    expect(caretAfterDigits(`100${NBSP}000`, 0)).toBe(0);
    expect(caretAfterDigits("12", 5)).toBe(2);
  });
});
