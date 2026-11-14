// Player names in the list: their default order and the form the name search compares.
import { lazy } from "./lazy.ts";

/** The locale of the default text order. */
export const NAME_LOCALE = "pl";

/** Polish alphabetical order: the default of every text sort. */
export const nameCollator = lazy(() => new Intl.Collator(NAME_LOCALE));

/** Text without case and diacritics (ł included, which has no decomposition), for search. */
export const searchKey = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/ł/giu, "l").toLowerCase();

/**
 * The name with its first word as an initial, "L. Messi", for a row too narrow for the whole name; also a
 * name fifa.db keeps whole in the surname, "R. Augusto" (owner, 2026-11-14). Null for a single word.
 */
export const initialNameOf = (firstName: string, surname: string): string | null => {
  if (firstName !== "" && surname !== "") return `${firstName.charAt(0)}. ${surname}`;
  const [first, ...rest] = `${firstName}${surname}`.split(" ").filter((word) => word !== "");
  return first === undefined || rest.length === 0 ? null : `${first.charAt(0)}. ${rest.join(" ")}`;
};
