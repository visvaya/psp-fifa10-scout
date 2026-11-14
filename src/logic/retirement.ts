// Who leaves football when the season ends. Found on two season turns of career saves (156 and 298
// departures, no exception; game-knowledge: retirement): the game retires a player once his age, counted
// as the game counts it, on 31 December of the year the season ends reaches players.retirementage.
import { gameAge } from "./overall-rating.ts";

/** December, as Date.UTC counts months. */
const DECEMBER = 11;
const LAST_DAY = 31;

/** Whether the player retires at the end of the season that starts in `seasonYear`. */
export const retiresAfterSeason = (
  birthdate: Date,
  retirementAge: number,
  seasonYear: number,
): boolean =>
  gameAge(birthdate, new Date(Date.UTC(seasonYear + 1, DECEMBER, LAST_DAY))) >= retirementAge;

/** Past this many seasons the search stops: no player of the game's tables plays that long. */
const SEASONS_SEARCHED_MAX = 60;

/**
 * His age in the season after which he retires, counted as `seasonAge` counts this season's: the age the
 * development charts place that season at.
 */
export const lastSeasonAge = (
  birthdate: Date,
  retirementAge: number,
  seasonYear: number,
  seasonAge: number,
): number => {
  const seasons = Array.from({ length: SEASONS_SEARCHED_MAX }, (_, years) => years);
  const ahead = seasons.find((years) =>
    retiresAfterSeason(birthdate, retirementAge, seasonYear + years),
  );
  return seasonAge + (ahead ?? SEASONS_SEARCHED_MAX);
};
