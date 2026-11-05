// A club's stars as the game shows them (docs: team-stars.md in the notes; EBOOT 0x089B6310): the mean OVR of
// its best 16 players, floored, against fixed thresholds, in half stars from 0.5 to 5.
import type { Player } from "./players.ts";

/** Each mean OVR at or above one of these adds half a star to the first half (0x089B5EC8). */
const TEAM_STAR_THRESHOLDS = [55, 60, 63, 65, 68, 71, 75, 78, 82] as const;
/** The players whose OVR the mean counts: the best of the squad (0x089B606C). */
const BEST_PLAYERS = 16;

/** Stars from the squad's OVRs, at the preferred positions and aged in a career. */
export const teamStars = (overalls: readonly number[]): number => {
  const best = overalls.toSorted((a, b) => b - a).slice(0, BEST_PLAYERS);
  const mean =
    best.length === 0 ? 0 : Math.floor(best.reduce((sum, value) => sum + value, 0) / best.length);
  return (1 + TEAM_STAR_THRESHOLDS.filter((threshold) => mean >= threshold).length) / 2;
};

/** The stars of every club some player belongs to, by club id. */
export const clubStarsOf = (
  players: readonly Pick<Player, "clubId" | "overall">[],
): ReadonlyMap<number, number> => {
  const squads = new Map<number, number[]>();
  for (const { clubId, overall } of players) {
    if (clubId !== null) squads.set(clubId, [...(squads.get(clubId) ?? []), overall]);
  }
  return new Map([...squads].map(([clubId, overalls]) => [clubId, teamStars(overalls)]));
};
