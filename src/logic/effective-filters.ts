import type { PlayerFilters } from "./filter-players.ts";
import type { ScoutFilters } from "./scout-state.ts";

/** The filters filterPlayers takes. The watchlist's player ids go in only while the own list filter is set. */
export const effectiveFilters = (
  { myClub, clubStatus, ...filters }: ScoutFilters,
  myTeamId: number | null,
  watchlistIds: ReadonlySet<number>,
): PlayerFilters => ({
  ...filters,
  ...(filters.flags?.onMyList === undefined ? {} : { myListIds: watchlistIds }),
  ...(clubStatus === "free-agents" && myTeamId !== null
    ? { freeAgentsOnly: true }
    : { availableOnly: true }),
  ...(myClub === undefined || myTeamId === null
    ? {}
    : myClub === "hide"
      ? { excludeTeamId: myTeamId }
      : { onlyTeamId: myTeamId }),
});
