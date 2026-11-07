// Where each player plays: his club (with its league and his contract link) and his national team.
import { effectiveRows } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { num, readTable } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";

interface Team {
  readonly id: number;
  readonly name: string;
  readonly leagueId: number;
  readonly leagueName: string;
  readonly level: number;
  readonly rating: number;
  /** League prestige plus team prestige. */
  readonly prestige: number;
  readonly leaguePrestige: number;
}

export interface Placement {
  readonly club?: { readonly team: Team; readonly link: EaDbRow };
  readonly national?: Team;
}

/**
 * Teams that belong to a league, with that league. A career save keeps the club leagues after promotion
 * and relegation but not the national teams' links, so its links overlay fifa.db's team by team.
 */
export const teamsById = (db: EaDb, save?: CareerSave): ReadonlyMap<number, Team> => {
  const leagues = new Map(readTable(db, "leagues").map((row) => [num(row, "leagueid"), row]));
  const leagueOfTeam = new Map(
    [...readTable(db, "leagueteamlinks"), ...(save?.get("leagueteamlinks") ?? [])].map((row) => [
      num(row, "teamid"),
      num(row, "leagueid"),
    ]),
  );
  return new Map(
    readTable(db, "teams").flatMap((row): [number, Team][] => {
      const id = num(row, "teamid");
      const league = leagues.get(leagueOfTeam.get(id) ?? -1);
      if (league === undefined) return [];
      const leagueId = num(league, "leagueid");
      const [name, leagueName] = [String(row["teamname"]), String(league["leaguename"])];
      const [level, rating] = [num(league, "level"), num(row, "overallrating")];
      const leaguePrestige = num(league, "leagueprestige");
      const prestige = leaguePrestige + num(row, "internationalprestige");
      return [[id, { id, name, leagueId, leagueName, level, rating, prestige, leaguePrestige }]];
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

/** The club fields; a loaned player's link holds no contract end (2005 or a renewal year). */
export const teamFields = ({ club, national }: Placement, onLoan: boolean) => ({
  ...(club === undefined
    ? NO_CLUB
    : {
        clubId: club.team.id,
        clubName: club.team.name,
        clubRating: club.team.rating,
        leagueId: club.team.leagueId,
        leagueName: club.team.leagueName,
        contractEndYear: onLoan ? null : num(club.link, "yearcontractvalidtil"),
        jerseyNumber: num(club.link, "jerseynumber"),
      }),
  nationalTeamId: national?.id ?? null,
  nationalTeamName: national?.name ?? null,
});

/**
 * The team links a career places players by: the save's, which hold the clubs only, and fifa.db's
 * national-team links, which no save read so far holds (whether the game changes call-ups in a career
 * is not known).
 */
export const careerLinks = (db: EaDb, save: CareerSave): readonly EaDbRow[] => {
  const national = new Set(
    readTable(db, "leagues")
      .filter((league) => num(league, "level") === SCOUT_CONFIG.nationalLeagueLevel)
      .map((league) => num(league, "leagueid")),
  );
  const nationalTeams = new Set(
    readTable(db, "leagueteamlinks")
      .filter((link) => national.has(num(link, "leagueid")))
      .map((link) => num(link, "teamid")),
  );
  return [
    ...effectiveRows(db, save, "teamplayerlinks"),
    ...readTable(db, "teamplayerlinks").filter((link) => nationalTeams.has(num(link, "teamid"))),
  ];
};
