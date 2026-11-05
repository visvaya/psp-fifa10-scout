// A decimal number as it is typed: either separator a keyboard offers becomes the one the interface
// language writes (a comma in Polish), at once; letters and further separators drop out.

const NOT_DECIMAL = /[^\d.,]/gu;

/** The text to show for what was typed, and the number it means (undefined without a digit). */
export const decimalText = (
  typed: string,
  separator: string,
): { readonly text: string; readonly value: number | undefined } => {
  const [whole = "", ...rest] = typed.replaceAll(NOT_DECIMAL, "").split(/[.,]/u);
  const fraction = rest.join("");
  const text = rest.length === 0 ? whole : `${whole}${separator}${fraction}`;
  const digits = `${whole}.${fraction}`;
  return { text, value: /\d/u.test(digits) ? Number(digits) : undefined };
};
