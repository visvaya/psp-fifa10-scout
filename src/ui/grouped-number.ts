// Numbers typed with their digits grouped ("1 000 000"): the value, and where the caret goes once the
// field regroups what was typed. Positions are UTF-16 indices, as the input's selection reports them.

const NOT_DIGIT = /\D/gu;
const DIGIT = /\d/gu;

/** The typed digits as a number, whatever separates them; undefined without a digit. */
export const groupedValue = (text: string): number | undefined => {
  const digits = text.replaceAll(NOT_DIGIT, "");
  return digits === "" ? undefined : Number(digits);
};

/** How many digits stand before the caret. */
export const digitsBefore = (text: string, caret: number): number =>
  text.slice(0, caret).replaceAll(NOT_DIGIT, "").length;

/** The caret position right after the given number of digits (the end when there are fewer). */
export const caretAfterDigits = (text: string, digits: number): number => {
  const ends = Array.from(text.matchAll(DIGIT), (match) => match.index + 1);
  return digits === 0 ? 0 : (ends[digits - 1] ?? text.length);
};
