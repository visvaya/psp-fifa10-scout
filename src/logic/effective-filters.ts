import { filterPlayers } from "./filter-players.ts";
import type { PlayerFilters } from "./filter-players.ts";
import type { ScoutFilters, ScoutState } from "./scout-state.ts";
import { watchedIds } from "./watchlist.ts";

/** The filters filterPlayers takes. The watchlist's player ids go in only while the list field is set. */
export const effectiveFilters = (
  { myClub, ...filters }: ScoutFilters,
  myTeamId: number | null,
  watchlistIds: ReadonlySet<number>,
): PlayerFilters => ({
  ...filters,
  ...(filters.onList === undefined ? {} : { myListIds: watchlistIds }),
  // The club status shows only with a career: fifa.db alone has no free agents.
  clubStatus: myTeamId === null ? "available" : (filters.clubStatus ?? "available"),
  ...(myClub === undefined || myTeamId === null
    ? {}
    : myClub === "hide"
      ? { excludeTeamId: myTeamId }
      : { onlyTeamId: myTeamId }),
});

/** How many players the list shows with the current filters, for the start screen's button. */
export const listedCount = (state: ScoutState): number =>
  state.players === null
    ? 0
    : filterPlayers(
        state.players,
        effectiveFilters(state.filters, state.myTeamId, watchedIds(state.watchlist)),
      ).length;
