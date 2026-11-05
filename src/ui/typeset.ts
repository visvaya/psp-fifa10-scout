// Polish line breaking in one place (docs: ui-text.md, "Łamanie wierszy"): a non-breaking space keeps a
// one-letter word, an abbreviation, an ordinal or a number on the line of the word after it.

export const NBSP = " ";

/**
 * After a one-letter conjunction or preposition or an abbreviation; after a number or an ordinal ("2.")
 * only before a word, a percent sign or a currency.
 */
const TIED_BEFORE =
  /(?<=(?:^|[\s(„])(?:[aiouwzAIOUWZ]|np\.|nr|ok\.|tzw\.|tj\.|m\.in\.|pkt|godz\.)) |(?<=\d\.?) (?=[\p{L}%€£$])/gu;

const CONTEXT_LENGTH = 6;

export const tie = (text: string): string => text.replace(TIED_BEFORE, NBSP);

/**
 * A text with its literal parts tied; values go in as they are (game names are data). The text
 * before each part counts as context, so a number value ties to the word after it.
 */
export const pl = (parts: TemplateStringsArray, ...values: readonly (string | number)[]): string =>
  parts.reduce((text, part, index) => {
    const before = index === 0 ? "" : `${text}${String(values[index - 1])}`;
    // Enough context for the longest tied word ("m.in.") and the character before it.
    const context = before.slice(-CONTEXT_LENGTH);
    return before + tie(context + part).slice(context.length);
  }, "");
