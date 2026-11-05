import type { PlayerFilters } from "./filter-players.ts";
import type { ScoutFilters } from "./scout-state.ts";
import { watchedIds } from "./watchlist.ts";
import type { WatchEntry } from "./watchlist.ts";

/** The filters filterPlayers takes. The watchlist's ids go in only while the own list filter is set. */
export const effectiveFilters = (
  { myClub, clubStatus, ...filters }: ScoutFilters,
  myTeamId: number | null,
  watchlist: readonly WatchEntry[],
): PlayerFilters => ({
  ...filters,
  ...(filters.flags?.onMyList === undefined ? {} : { myListIds: watchedIds(watchlist) }),
  ...(clubStatus === "free-agents" && myTeamId !== null
    ? { freeAgentsOnly: true }
    : { availableOnly: true }),
  ...(myClub === undefined || myTeamId === null
    ? {}
    : myClub === "hide"
      ? { excludeTeamId: myTeamId }
      : { onlyTeamId: myTeamId }),
});
