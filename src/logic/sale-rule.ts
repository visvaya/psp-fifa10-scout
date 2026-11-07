// Whether a club may sell a player to the user at all, before any fee, and why not (docs: sale-refusals
// spec in the notes, decoded from the game's code): the club has too few players in his position group,
// or 19 or fewer (offer code 6), or it is the user's historic rival (11). The user's own full squad
// (code 7) refuses every offer alike, so it says nothing about a player and is left out here.

import { careerLoans, careerManager, seasonStartDate } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { num, readTable } from "../data/ea-db.ts";
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

/** Why the game refuses any offer for a player, whatever the fee. */
export type SaleRefusal = "position" | "squad" | "rivals";

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

/** Why the club refuses to sell a player of this position (his own count included), or null. */
export const squadRefusal = (
  squad: ClubSquad,
  positionCode: number,
  leaguePrestige: number,
): "position" | "squad" | null => {
  const group = POSITION_GROUP[positionCode];
  const minimums =
    leaguePrestige >= SALE_RULE.highPrestigeFrom
      ? SALE_RULE.groupMinimum.high
      : SALE_RULE.groupMinimum.low;
  const groupFine = group === undefined || (squad.groups[group] ?? 0) >= (minimums[group] ?? 0);
  if (!groupFine) return "position";
  return squad.size > SALE_RULE.squadMoreThan ? null : "squad";
};

/** The clubs that are the given club's historic rivals (fifa.db `historicrivalries`, either order). */
const rivalsOf = (db: EaDb, teamId: number): ReadonlySet<number> =>
  new Set(
    (db.tables.has("historicrivalries") ? readTable(db, "historicrivalries") : []).flatMap(
      (row) => {
        const [first, second] = [num(row, "clubid1"), num(row, "clubid2")];
        return first === teamId ? [second] : second === teamId ? [first] : [];
      },
    ),
  );

/** The sale fields from the game's verdict on an offer for the player. */
export const saleFields = (verdict: SaleRefusal | "sells" | null) => ({
  clubWillSell: verdict === null ? null : verdict === "sells",
  saleRefusal: verdict === null || verdict === "sells" ? null : verdict,
});

/**
 * For each player of another club in a career: why the game refuses any offer for him, or "sells"; null
 * without a club or in the user's own. A contract that has run out skips the club's refusals, as the game
 * does.
 */
export const saleVerdictOf = (
  db: EaDb,
  save: CareerSave,
  placements: ReadonlyMap<number, Placement>,
): ((playerId: number) => SaleRefusal | "sells" | null) => {
  const preferred = new Map(
    readTable(db, "players").map((row) => [num(row, "playerid"), num(row, "preferredposition1")]),
  );
  const loans = careerLoans(db, save);
  const loaned = new Set(loans.map((row) => num(row, "playerid")));
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
  const { teamId } = careerManager(db, save);
  const rivals = rivalsOf(db, teamId);
  // The user's own players on loan at another club: no offer to make for them either.
  const lentOut = new Set(
    loans.filter((row) => num(row, "oldteamid") === teamId).map((row) => num(row, "playerid")),
  );
  return (playerId) => {
    const club = placements.get(playerId)?.club;
    const squad = club === undefined ? undefined : squads.get(club.team.id);
    if (club === undefined || squad === undefined || club.team.id === teamId) return null;
    if (lentOut.has(playerId)) return null;
    if (num(club.link, "yearcontractvalidtil") <= seasonYear) return "sells";
    const refusal = squadRefusal(squad, preferred.get(playerId) ?? -1, club.team.leaguePrestige);
    return refusal ?? (rivals.has(club.team.id) ? "rivals" : "sells");
  };
};
