// Numbers typed with their digits grouped ("1 000 000"): the value, and where the caret goes once the
// field regroups what was typed. Positions are UTF-16 indices, as the input's selection reports them.

const NOT_DIGIT = /\D/gu;
const DIGIT = /\d/gu;

const digitsOf = (text: string): string => text.replaceAll(NOT_DIGIT, "");

/** How many digits stand before the caret. */
export const digitsBefore = (text: string, caret: number): number =>
  digitsOf(text.slice(0, caret)).length;

/** The caret position right after the given number of digits (the end when there are fewer). */
export const caretAfterDigits = (text: string, digits: number): number => {
  const ends = Array.from(text.matchAll(DIGIT), (match) => match.index + 1);
  return digits === 0 ? 0 : (ends[digits - 1] ?? text.length);
};

/**
 * One keystroke in a grouped field: the value it leaves (undefined without a digit) and the digits before
 * the caret. A key that deleted only a separator deletes the digit it aimed at instead (after the caret
 * for Delete, before it for Backspace), or the separator would come back and the key would do nothing.
 */
export const editGrouped = (edit: {
  readonly shown: string;
  readonly typed: string;
  readonly caret: number;
  readonly inputType: string;
}): { readonly value: number | undefined; readonly digitsBeforeCaret: number } => {
  const digits = digitsOf(edit.typed);
  const before = digitsBefore(edit.typed, edit.caret);
  const separatorOnly = edit.typed.length < edit.shown.length && digits === digitsOf(edit.shown);
  const index = !separatorOnly
    ? null
    : edit.inputType === "deleteContentForward"
      ? before
      : edit.inputType === "deleteContentBackward"
        ? before - 1
        : null;
  const kept =
    index === null || index < 0 || index >= digits.length
      ? { digits, before }
      : { digits: digits.slice(0, index) + digits.slice(index + 1), before: index };
  return {
    value: kept.digits === "" ? undefined : Number(kept.digits),
    digitsBeforeCaret: kept.before,
  };
};
