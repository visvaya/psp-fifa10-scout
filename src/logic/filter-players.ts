// Declarative player filters: each set field adds one predicate, and a player must pass them all.
import { ATTRIBUTE_NAMES, searchKey } from "./players.ts";
import type { AttributeName, Player } from "./players.ts";
import type { PositionGroup } from "./positions.ts";

interface Range {
  readonly min?: number;
  readonly max?: number;
}

export interface PlayerFilters {
  /** Part of the name, ignoring case and diacritics. */
  readonly text?: string;
  readonly positionGroups?: readonly PositionGroup[];
  readonly age?: Range;
  readonly potential?: Range;
  readonly attributeMin?: Readonly<Partial<Record<AttributeName, number>>>;
  readonly leagueIds?: readonly number[];
  /** Club ids. */
  readonly teamIds?: readonly number[];
  readonly nationalityIds?: readonly number[];
  /** Contracts ending in this year or earlier. */
  readonly contractEndsBy?: number;
  readonly freeAgentsOnly?: boolean;
  /** Leaves out this club's players (the user's own team). */
  readonly excludeTeamId?: number;
}

type Predicate = (player: Player) => boolean;

const inRange =
  (range: Range, value: (player: Player) => number): Predicate =>
  (player) =>
    value(player) >= (range.min ?? -Infinity) && value(player) <= (range.max ?? Infinity);

const oneOf = (
  ids: readonly number[] | undefined,
  value: (player: Player) => number | null,
): Predicate | null => {
  if (ids === undefined || ids.length === 0) return null;
  const wanted = new Set<number | null>(ids);
  return (player) => wanted.has(value(player));
};

const predicates = (filters: PlayerFilters): readonly (Predicate | null)[] => {
  const text = searchKey(filters.text?.trim() ?? "");
  const groups = filters.positionGroups ?? [];
  const minimums = ATTRIBUTE_NAMES.flatMap((name) => {
    const min = filters.attributeMin?.[name];
    return min === undefined ? [] : [[name, min] as const];
  });
  const { contractEndsBy, excludeTeamId } = filters;
  // Unset filters add no predicate (null), which keeps a full scan of 13 000 players cheap.
  return [
    text === "" ? null : (player) => player.searchName.includes(text),
    groups.length === 0 ? null : (player) => groups.includes(player.positionGroup),
    filters.age === undefined ? null : inRange(filters.age, (player) => player.age),
    filters.potential === undefined
      ? null
      : inRange(filters.potential, (player) => player.potential),
    minimums.length === 0
      ? null
      : (player) => minimums.every(([name, min]) => player.attributes[name] >= min),
    oneOf(filters.leagueIds, (player) => player.leagueId),
    oneOf(filters.teamIds, (player) => player.clubId),
    oneOf(filters.nationalityIds, (player) => player.nationalityId),
    contractEndsBy === undefined
      ? null
      : (player) => player.contractEndYear !== null && player.contractEndYear <= contractEndsBy,
    filters.freeAgentsOnly === true ? (player) => player.clubId === null : null,
    excludeTeamId === undefined ? null : (player) => player.clubId !== excludeTeamId,
  ];
};

/** The players that pass every set filter; empty filters return all of them. */
export const filterPlayers = (
  players: readonly Player[],
  filters: PlayerFilters,
): readonly Player[] => {
  const active = predicates(filters).filter((predicate) => predicate !== null);
  return players.filter((player) => active.every((predicate) => predicate(player)));
};
