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
