// Whether a club may sell a player to the user at all, before any fee: the game refuses (offer code 6)
// when the club has too few players in his position group, or 19 players or fewer (docs: negotiation
// spec, decoded from the game's code; it explains a refusal seen on the owner's screen).

import { seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { readTable } from "../data/ea-db.ts";
import type { EaDb } from "../data/ea-db.ts";
import type { Placement } from "./placements.ts";

/** The position group of each position code 0..31, as the game reads it (GK, left backs, centre-backs,
 * right backs, left mids, central mids, right mids, forwards). */
const POSITION_GROUP: readonly number[] = [
  0, 2, 3, 3, 2, 2, 2, 1, 1, 6, 5, 5, 5, 4, 6, 6, 5, 5, 5, 4, 4, 6, 5, 5, 5, 4, 7, 7, 7, 7, 7, 7,
];

const SALE_RULE = {
  groups: 8,
  /** The least players a group keeps, by group, in a league of prestige 12 or more, and below. */
  groupMinimum: { high: [2, 2, 4, 2, 2, 4, 2, 4], low: [2, 2, 3, 2, 2, 3, 2, 3] },
  highPrestigeFrom: 12,
  /** CAREER/TRANSFER_MIN_TEAM_SIZE: the club must have more players than this. */
  squadMoreThan: 19,
} as const;

export interface ClubSquad {
  /** Every player linked to the club, those on loan at it included. */
  readonly size: number;
  /** Players per position group, by preferred position, without those on loan at the club. */
  readonly groups: readonly number[];
}

/** The squad of each club from its players' links. */
export const squadsOf = (
  links: readonly {
    readonly teamId: number;
    readonly positionCode: number;
    readonly loaned: boolean;
  }[],
): ReadonlyMap<number, ClubSquad> => {
  const squads = new Map<number, { size: number; groups: number[] }>();
  for (const { teamId, positionCode, loaned } of links) {
    const squad = squads.get(teamId) ?? {
      size: 0,
      groups: Array.from({ length: SALE_RULE.groups }, () => 0),
    };
    squad.size += 1;
    const group = POSITION_GROUP[positionCode];
    if (!loaned && group !== undefined) squad.groups[group] = (squad.groups[group] ?? 0) + 1;
    squads.set(teamId, squad);
  }
  return squads;
};

/** The club does not refuse to sell a player of this position (his own count included). */
export const clubWillSell = (
  squad: ClubSquad,
  positionCode: number,
  leaguePrestige: number,
): boolean => {
  const group = POSITION_GROUP[positionCode];
  const minimums =
    leaguePrestige >= SALE_RULE.highPrestigeFrom
      ? SALE_RULE.groupMinimum.high
      : SALE_RULE.groupMinimum.low;
  const groupFine = group === undefined || (squad.groups[group] ?? 0) >= (minimums[group] ?? 0);
  return groupFine && squad.size > SALE_RULE.squadMoreThan;
};

/**
 * For each player with a club in a career: whether the club will sell him; null without a club. A
 * contract that has run out skips the refusal, as the game does.
 */
export const clubWillSellOf = (
  db: EaDb,
  save: CareerSave,
  placements: ReadonlyMap<number, Placement>,
): ((playerId: number) => boolean | null) => {
  const preferred = new Map(
    readTable(db, "players").map((row) => [
      Number(row["playerid"]),
      Number(row["preferredposition1"]),
    ]),
  );
  // fifa.db's loan list is empty: only a save holds loans.
  const loaned = new Set(
    (save.get("career_loaned_list") ?? []).map((row) => Number(row["playerid"])),
  );
  const squads = squadsOf(
    [...placements].flatMap(([playerId, { club }]) =>
      club === undefined
        ? []
        : [
            {
              teamId: club.team.id,
              positionCode: preferred.get(playerId) ?? -1,
              loaned: loaned.has(playerId),
            },
          ],
    ),
  );
  const seasonYear = seasonStartDate(db, save).getUTCFullYear();
  return (playerId) => {
    const club = placements.get(playerId)?.club;
    const squad = club === undefined ? undefined : squads.get(club.team.id);
    if (club === undefined || squad === undefined) return null;
    if (Number(club.link["yearcontractvalidtil"]) <= seasonYear) return true;
    return clubWillSell(squad, preferred.get(playerId) ?? -1, club.team.leaguePrestige);
  };
};
