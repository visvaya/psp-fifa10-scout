// Where each player plays: his club (with its league and his contract link) and his national team.
import { readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";

const num = (row: EaDbRow, key: string): number => Number(row[key]);

interface Team {
  readonly id: number;
  readonly name: string;
  readonly leagueId: number;
  readonly leagueName: string;
  readonly level: number;
  readonly rating: number;
  /** League prestige plus team prestige. */
  readonly prestige: number;
}

export interface Placement {
  readonly club?: { readonly team: Team; readonly link: EaDbRow };
  readonly national?: Team;
}

/** Teams that belong to a league, with that league. */
export const teamsById = (db: EaDb): ReadonlyMap<number, Team> => {
  const leagues = new Map(readTable(db, "leagues").map((row) => [num(row, "leagueid"), row]));
  const leagueOfTeam = new Map(
    readTable(db, "leagueteamlinks").map((row) => [num(row, "teamid"), num(row, "leagueid")]),
  );
  return new Map(
    readTable(db, "teams").flatMap((row): [number, Team][] => {
      const id = num(row, "teamid");
      const league = leagues.get(leagueOfTeam.get(id) ?? -1);
      if (league === undefined) return [];
      const leagueId = num(league, "leagueid");
      const [name, leagueName] = [String(row["teamname"]), String(league["leaguename"])];
      const [level, rating] = [num(league, "level"), num(row, "overallrating")];
      const prestige = num(league, "leagueprestige") + num(row, "internationalprestige");
      return [[id, { id, name, leagueId, leagueName, level, rating, prestige }]];
    }),
  );
};

/** Each linked player's club (first link to a club league) and national team. */
export const placementsOf = (
  links: readonly EaDbRow[],
  teams: ReadonlyMap<number, Team>,
): ReadonlyMap<number, Placement> => {
  const placements = new Map<number, Placement>();
  for (const link of links) {
    const team = teams.get(num(link, "teamid"));
    const playerId = num(link, "playerid");
    const placement = placements.get(playerId) ?? {};
    if (team === undefined) continue;
    if (team.level < SCOUT_CONFIG.clubLeagueLevelBelow && placement.club === undefined) {
      placements.set(playerId, { ...placement, club: { team, link } });
    } else if (team.level === SCOUT_CONFIG.nationalLeagueLevel) {
      placements.set(playerId, { ...placement, national: team });
    }
  }
  return placements;
};

const NO_CLUB = {
  clubId: null,
  clubName: null,
  clubRating: null,
  leagueId: null,
  leagueName: null,
  contractEndYear: null,
  jerseyNumber: null,
} as const;

export const teamFields = ({ club, national }: Placement) => ({
  ...(club === undefined
    ? NO_CLUB
    : {
        clubId: club.team.id,
        clubName: club.team.name,
        clubRating: club.team.rating,
        leagueId: club.team.leagueId,
        leagueName: club.team.leagueName,
        contractEndYear: num(club.link, "yearcontractvalidtil"),
        jerseyNumber: num(club.link, "jerseynumber"),
      }),
  nationalTeamId: national?.id ?? null,
  nationalTeamName: national?.name ?? null,
});
