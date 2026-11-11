// Player names in the list: their default order and the form the name search compares.
import { lazy } from "./lazy.ts";

/** The locale of the default text order. */
export const NAME_LOCALE = "pl";

/** Polish alphabetical order: the default of every text sort. */
export const nameCollator = lazy(() => new Intl.Collator(NAME_LOCALE));

/** Text without case and diacritics (ł included, which has no decomposition), for search. */
export const searchKey = (text: string): string =>
  text.normalize("NFD").replaceAll(/\p{M}/gu, "").replaceAll(/ł/giu, "l").toLowerCase();
