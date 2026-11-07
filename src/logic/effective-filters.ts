import type { PlayerFilters } from "./filter-players.ts";
import type { ScoutFilters } from "./scout-state.ts";

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
