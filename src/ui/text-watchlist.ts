// The texts of the own watchlist on the player card (watchlist-section.tsx), a part of the UI texts
// beside text.ts. The list is named to tell it from the game's wish list.
import { pl } from "./typeset.ts";

export const WATCHLIST_TEXT = {
  title: pl`Twoja lista w narzędziu`,
  add: pl`Dodaj do twojej listy w narzędziu`,
  remove: pl`Usuń z twojej listy w narzędziu`,
} as const;
