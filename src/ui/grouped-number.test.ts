import { describe, expect, it } from "vitest";
import { caretAfterDigits, digitsBefore, editGrouped } from "./grouped-number.ts";

const NBSP = " ";
const typing = (typed: string, caret: number, shown = "", inputType = "insertText") =>
  editGrouped({ shown, typed, caret, inputType });

describe("grouped numbers", () => {
  it("reads the typed digits, whatever separates them", () => {
    expect(typing(`1${NBSP}000${NBSP}000`, 9).value).toBe(1_000_000);
    expect(typing("2 500 €", 7).value).toBe(2500);
    expect(typing("0", 1).value).toBe(0);
    expect(typing(` ${NBSP}x`, 3).value).toBeUndefined();
  });

  it("keeps the caret after the same digit once the number is regrouped", () => {
    // Typed "10000|0" (caret before the last digit) becomes "100 000": the caret stays after 5 digits.
    const { digitsBeforeCaret } = typing("100000", 5, `10${NBSP}000`);
    expect(digitsBeforeCaret).toBe(5);
    expect(digitsBefore("100000", 5)).toBe(5);
    expect(caretAfterDigits(`100${NBSP}000`, digitsBeforeCaret)).toBe(6);
    expect(caretAfterDigits(`100${NBSP}000`, 3)).toBe(3);
    expect(caretAfterDigits(`100${NBSP}000`, 0)).toBe(0);
    expect(caretAfterDigits("12", 5)).toBe(2);
  });

  it("deletes the digit beyond a separator that a key deleted alone", () => {
    const shown = `10${NBSP}000`;
    // Delete before the separator: "10|000" left, the next digit goes.
    expect(typing("10000", 2, shown, "deleteContentForward")).toEqual({
      value: 1000,
      digitsBeforeCaret: 2,
    });
    // Backspace after it: "10|000" left, the digit before goes.
    expect(typing("10000", 2, shown, "deleteContentBackward")).toEqual({
      value: 1000,
      digitsBeforeCaret: 1,
    });
    // At either end nothing is beyond; a digit deleted is just deleted.
    expect(typing("000", 0, `${NBSP}000`, "deleteContentBackward").value).toBe(0);
    expect(typing("10", 2, `10${NBSP}`, "deleteContentForward").value).toBe(10);
    expect(typing("1000", 1, shown, "deleteContentBackward")).toEqual({
      value: 1000,
      digitsBeforeCaret: 1,
    });
  });
});
