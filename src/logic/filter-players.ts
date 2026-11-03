// Declarative player filters: each set filter adds one predicate, and a player must pass them all.
// Lists keep any of the chosen values, ranges are inclusive, flags require a trait or its absence.
import { ATTRIBUTE_NAMES, isAttributeName, searchKey, TRAIT_NAMES } from "./players.ts";
import type { AttributeName, Player, TraitName } from "./players.ts";

export interface Range {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

/** Number fields a range can apply to; a player without the value (null) never passes. */
const RANGE_FIELDS = [
  "age",
  "overall",
  "potential",
  "growth",
  "height",
  "weight",
  "weakFoot",
  "internationalReputation",
  "learningSpeed",
  "retirementAge",
  "clubRating",
  "contractEndYear",
  "form",
  "morale",
  "injuryDays",
] as const satisfies readonly (keyof Player)[];

export type RangeFields = (typeof RANGE_FIELDS)[number];
export type RangeKey = RangeFields | AttributeName;
export const RANGE_KEYS: readonly RangeKey[] = [...RANGE_FIELDS, ...ATTRIBUTE_NAMES];

/** Fields chosen from a list of values. */
export const LIST_FIELDS = [
  "positionCode",
  "positionGroup",
  "bodyType",
  "preferredFoot",
  "developmentType",
  "developmentStyle",
  "leagueId",
  "clubId",
  "nationalityId",
] as const satisfies readonly (keyof Player)[];

export type ListKey = (typeof LIST_FIELDS)[number];
export type FlagKey = TraitName | "nationalTeam" | "transferListed";
export const FLAG_KEYS: readonly FlagKey[] = [...TRAIT_NAMES, "nationalTeam", "transferListed"];

export interface PlayerFilters {
  /** Part of the name, ignoring case and diacritics. */
  readonly text?: string;
  readonly ranges?: { readonly [K in RangeKey]?: Range | undefined };
  readonly lists?: { readonly [K in ListKey]?: readonly NonNullable<Player[K]>[] | undefined };
  /** true: the player has it; false: he does not. */
  readonly flags?: { readonly [K in FlagKey]?: boolean | undefined };
  /** OVR at one position code, whatever the preferred position. */
  readonly positionRating?: PositionRating;
  readonly freeAgentsOnly?: boolean;
  /** Leaves out players without a club (legends, national-team-only players), keeping academy youth. */
  readonly withClubOnly?: boolean;
  /** Leaves out this club's players (the user's own team). */
  readonly excludeTeamId?: number;
}

export interface PositionRating extends Range {
  readonly code: number;
}

type Predicate = (player: Player) => boolean;

const rangeValue = (player: Player, key: RangeKey): number | null =>
  isAttributeName(key) ? player.attributes[key] : player[key];

const hasFlag = (player: Player, flag: FlagKey): boolean => {
  if (flag === "nationalTeam") return player.nationalTeamId !== null;
  return flag === "transferListed" ? player.transferListed : player.traits.includes(flag);
};

/** Keeps players whose value is set and within the inclusive range. */
const inRange =
  (
    { min = -Infinity, max = Infinity }: Range,
    value: (player: Player) => number | null | undefined,
  ): Predicate =>
  (player) => {
    const current = value(player);
    return current !== null && current !== undefined && current >= min && current <= max;
  };

const predicates = (filters: PlayerFilters): readonly Predicate[] => {
  const text = searchKey(filters.text?.trim() ?? "");
  const { excludeTeamId } = filters;
  const rating = filters.positionRating;
  return [
    ...(text === "" ? [] : [(player: Player) => player.searchName.includes(text)]),
    ...RANGE_KEYS.flatMap((key) => {
      const range = filters.ranges?.[key];
      return range === undefined ? [] : [inRange(range, (player) => rangeValue(player, key))];
    }),
    ...LIST_FIELDS.flatMap((key) => {
      const values: readonly unknown[] = filters.lists?.[key] ?? [];
      const wanted = new Set(values);
      return values.length === 0 ? [] : [(player: Player) => wanted.has(player[key])];
    }),
    ...(rating === undefined
      ? []
      : [inRange(rating, (player) => player.overallByCode[rating.code])]),
    ...FLAG_KEYS.flatMap((flag) => {
      const wanted = filters.flags?.[flag];
      return wanted === undefined ? [] : [(player: Player) => hasFlag(player, flag) === wanted];
    }),
    // A youth-pool player without a club sits in the user's academy, so he is not on the market.
    ...(filters.freeAgentsOnly === true
      ? [(player: Player) => player.clubId === null && !player.youth]
      : []),
    ...(filters.withClubOnly === true
      ? [(player: Player) => player.clubId !== null || player.youth]
      : []),
    ...(excludeTeamId === undefined ? [] : [(player: Player) => player.clubId !== excludeTeamId]),
  ];
};

/** The players that pass every set filter; empty filters return all of them. */
export const filterPlayers = (
  players: readonly Player[],
  filters: PlayerFilters,
): readonly Player[] => {
  const active = predicates(filters);
  return players.filter((player) => active.every((predicate) => predicate(player)));
};
