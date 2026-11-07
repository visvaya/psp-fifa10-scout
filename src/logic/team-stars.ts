// A team's stars as the game computes them from its squad (docs: team-stars spec in the notes, decoded
// from the game's code): no table stores them, so they change with transfers and growth.
import { num } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";

const TEAM_STARS = {
  /** The game reads at most this many of a team's links. */
  linksRead: 30,
  /** The best OVRs the mean takes. */
  best: 16,
  /** Each mean at or above one adds half a star to the first half. */
  halfStarFrom: [55, 60, 63, 65, 68, 71, 75, 78, 82],
} as const;

/** Stars 0.5..5 in halves from the OVRs of a team's links in table order. */
export const teamStars = (overalls: readonly number[]): number => {
  const best = overalls
    .slice(0, TEAM_STARS.linksRead)
    .toSorted((a, b) => b - a)
    .slice(0, TEAM_STARS.best);
  const sum = best.reduce((total, overall) => total + overall, 0);
  const mean = best.length === 0 ? 0 : Math.floor(sum / best.length);
  return (1 + TEAM_STARS.halfStarFrom.filter((threshold) => mean >= threshold).length) / 2;
};

/**
 * Each club's stars from the OVRs of the players its links place in it, in table order; a link to a
 * player without an OVR (no players row) does not count. Null without a club.
 */
export const clubStarsOf = (
  players: readonly { readonly id: number; readonly overall: number }[],
  links: readonly EaDbRow[],
): ((clubId: number | null) => number | null) => {
  const overallOf = new Map(players.map(({ id, overall }) => [id, overall]));
  const squads = new Map<number, number[]>();
  for (const link of links) {
    const overall = overallOf.get(num(link, "playerid"));
    if (overall === undefined) continue;
    const teamId = num(link, "teamid");
    squads.set(teamId, [...(squads.get(teamId) ?? []), overall]);
  }
  const stars = new Map([...squads].map(([teamId, overalls]) => [teamId, teamStars(overalls)]));
  return (clubId) => (clubId === null ? null : (stars.get(clubId) ?? null));
};
