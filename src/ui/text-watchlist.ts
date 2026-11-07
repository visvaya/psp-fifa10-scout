// The texts of the own watchlist on the player card (watchlist-section.tsx), a part of the UI texts
// beside text.ts. The list is named to tell it from the game's wish list.
import { pl } from "./typeset.ts";

export const WATCHLIST_TEXT = {
  title: "Moja lista",
  add: "Dodaj do mojej listy",
  remove: pl`Usuń z mojej listy`,
  removeQuestion: pl`Usunąć zawodnika z mojej listy? Jego notatka przepadnie.`,
  note: "Notatka",
} as const;
