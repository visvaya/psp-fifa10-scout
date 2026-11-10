// The user's own watchlist: players kept without the game's limit of 20. One list for the whole tool,
// keyed by the player id that fifa.db and the career saves share. Notes live apart (player-notes.ts).
import type { Player } from "./players.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";

export interface WatchEntry {
  readonly playerId: number;
  /** When the player was added, as an ISO date and time. */
  readonly addedAt: string;
}

/** The list with a player added last; a player already on it keeps his entry. */
export const watchedPlayer = (
  list: readonly WatchEntry[],
  playerId: number,
  addedAt: string,
): readonly WatchEntry[] =>
  list.some((entry) => entry.playerId === playerId) ? list : [...list, { playerId, addedAt }];

export const unwatchedPlayer = (
  list: readonly WatchEntry[],
  playerId: number,
): readonly WatchEntry[] => list.filter((entry) => entry.playerId !== playerId);

export const watchedIds = (list: readonly WatchEntry[]): ReadonlySet<number> =>
  new Set(list.map((entry) => entry.playerId));

/** A player on a list; undefined for an id of the own list the loaded players lack. */
export interface ListedPlayer {
  readonly id: number;
  readonly player: Player | undefined;
}

/** The own list latest added first, or the game's shortlist with the highest OVR first. */
export const listedPlayers = (
  which: "tool" | "game",
  list: readonly WatchEntry[],
  players: readonly Player[],
): readonly ListedPlayer[] => {
  if (which === "game")
    return players
      .filter((player) => player.shortlisted)
      .toSorted((a, b) => b.overall - a.overall)
      .map((player) => ({ id: player.id, player }));
  const byId = new Map(players.map((player) => [player.id, player] as const));
  return list
    .toSorted((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
    .map(({ playerId }) => ({ id: playerId, player: byId.get(playerId) }));
};

export type WatchlistAction =
  | { readonly type: "watchlist-restored"; readonly watchlist: readonly WatchEntry[] }
  | { readonly type: "watch-added"; readonly id: number; readonly addedAt: string }
  | { readonly type: "watch-removed"; readonly id: number };

/** The list after an action of the own watchlist. */
const watchlistAfter = (
  list: readonly WatchEntry[],
  action: WatchlistAction,
): readonly WatchEntry[] => {
  switch (action.type) {
    case "watchlist-restored":
      return action.watchlist;
    case "watch-added":
      return watchedPlayer(list, action.id, action.addedAt);
    // Stryker disable next-line StringLiteral: the case falls through to default, so its label changes nothing.
    case "watch-removed":
    default:
      return unwatchedPlayer(list, action.id);
  }
};

export const isWatchlistAction = (action: ScoutAction): action is WatchlistAction =>
  action.type.startsWith("watch");

/** The state after an action of the watchlist; restoring the stored list is no edit of it. */
export const watchlistReducer = (state: ScoutState, action: WatchlistAction): ScoutState => ({
  ...state,
  watchlist: watchlistAfter(state.watchlist, action),
  watchlistEdited: action.type !== "watchlist-restored",
});
