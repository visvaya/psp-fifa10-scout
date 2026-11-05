// The choices the filter form offers for leagues, clubs, nationalities and codes, from the loaded players.
import { nameCollator } from "./players.ts";
import type { Player } from "./players.ts";
import type { ScoutFilters } from "./scout-state.ts";

export interface FacetOption {
  readonly id: number;
  readonly name: string;
}

const options = (
  pairs: readonly (readonly [number | null, string | null])[],
  collator: Intl.Collator,
): FacetOption[] =>
  [
    ...new Map(
      pairs.flatMap(([id, name]) => (id === null || name === null ? [] : [[id, name] as const])),
    ),
  ]
    .map(([id, name]) => ({ id, name }))
    .toSorted((a, b) => collator.compare(a.name, b.name));

const distinct = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].toSorted((a, b) => a - b);

/** The choices for the league, club, nationality and contract filters; clubs within the chosen leagues. */
export const facetOptions = (
  players: readonly Player[],
  filters: ScoutFilters,
  collator: Intl.Collator = nameCollator,
) => {
  const leagues = new Set(filters.lists?.leagueId ?? []);
  const inLeagues = players.filter(
    (player) => leagues.size === 0 || (player.leagueId !== null && leagues.has(player.leagueId)),
  );
  return {
    leagues: options(
      players.map((player) => [player.leagueId, player.leagueName]),
      collator,
    ),
    clubs: options(
      inLeagues.map((player) => [player.clubId, player.clubName]),
      collator,
    ),
    nationalities: options(
      players.map((player) => [player.nationalityId, player.nationalityName]),
      collator,
    ),
    contractYears: distinct(players.flatMap((player) => player.contractEndYear ?? [])),
    codes: {
      positionCode: distinct(players.map((player) => player.positionCode)),
      bodyType: distinct(players.map((player) => player.bodyType)),
      developmentType: distinct(players.map((player) => player.developmentType)),
      developmentStyle: distinct(players.map((player) => player.developmentStyle)),
    },
  };
};
