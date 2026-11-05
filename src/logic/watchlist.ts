// The user's own watchlist: players kept with a note, without the game's limit of 20. One list for the whole
// tool, keyed by the player id that fifa.db and the career saves share.
import { SCOUT_CONFIG } from "./config.ts";

export interface WatchEntry {
  readonly playerId: number;
  /** Free text, up to SCOUT_CONFIG.watchlistNoteMaxChars characters; may be empty. */
  readonly note: string;
  /** When the player was added, as an ISO date and time. */
  readonly addedAt: string;
}

export const clippedNote = (note: string): string =>
  note.slice(0, SCOUT_CONFIG.watchlistNoteMaxChars);

/** The list with a player added last; a player already on it keeps his entry. */
export const watchedPlayer = (
  list: readonly WatchEntry[],
  playerId: number,
  addedAt: string,
): readonly WatchEntry[] =>
  list.some((entry) => entry.playerId === playerId)
    ? list
    : [...list, { playerId, note: "", addedAt }];

export const unwatchedPlayer = (
  list: readonly WatchEntry[],
  playerId: number,
): readonly WatchEntry[] => list.filter((entry) => entry.playerId !== playerId);

/** The list with one player's note replaced (cut to the limit); a player not on it changes nothing. */
export const notedPlayer = (
  list: readonly WatchEntry[],
  playerId: number,
  note: string,
): readonly WatchEntry[] =>
  list.some((entry) => entry.playerId === playerId)
    ? list.map((entry) =>
        entry.playerId === playerId ? { ...entry, note: clippedNote(note) } : entry,
      )
    : list;

export const watchedIds = (list: readonly WatchEntry[]): ReadonlySet<number> =>
  new Set(list.map((entry) => entry.playerId));

export type WatchlistAction =
  | { readonly type: "watchlist-restored"; readonly watchlist: readonly WatchEntry[] }
  | { readonly type: "watch-added"; readonly id: number; readonly addedAt: string }
  | { readonly type: "watch-removed"; readonly id: number }
  | { readonly type: "watch-note-changed"; readonly id: number; readonly note: string };

/** The list after an action of the own watchlist. */
export const watchlistAfter = (
  list: readonly WatchEntry[],
  action: WatchlistAction,
): readonly WatchEntry[] => {
  switch (action.type) {
    case "watchlist-restored":
      return action.watchlist;
    case "watch-added":
      return watchedPlayer(list, action.id, action.addedAt);
    case "watch-removed":
      return unwatchedPlayer(list, action.id);
    case "watch-note-changed":
    default:
      return notedPlayer(list, action.id, action.note);
  }
};
