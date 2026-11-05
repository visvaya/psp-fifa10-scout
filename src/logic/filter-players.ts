// Declarative player filters: each set filter adds one predicate, and a player must pass them all.
// Lists keep any of the chosen values, ranges are inclusive, flags require a trait or its absence.
import {
  ATTRIBUTE_NAMES,
  isAttributeName,
  searchKey,
  SEASON_STAT_KEYS,
  TRAIT_NAMES,
} from "./players.ts";
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
  "peak",
  "peakGain",
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
  ...SEASON_STAT_KEYS,
  "injuryDays",
  "price",
  "wage",
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
export type FlagKey =
  | TraitName
  | "nationalTeam"
  | "transferListed"
  | "loanListed"
  | "loaned"
  | "shortlisted"
  | "clubWillSell";
export const FLAG_KEYS: readonly FlagKey[] = [
  ...TRAIT_NAMES,
  "nationalTeam",
  "transferListed",
  "loanListed",
  "loaned",
  "shortlisted",
  "clubWillSell",
];

/** The ranges only a career save fills: without one every player has null and none passes. */
export const CAREER_RANGE_KEYS = [
  "peak",
  "peakGain",
  "form",
  "morale",
  ...SEASON_STAT_KEYS,
  "injuryDays",
  "price",
  "wage",
] as const satisfies readonly RangeKey[];

/** The flags only a career save sets: without one every player lacks them. */
export const CAREER_FLAG_KEYS = [
  "transferListed",
  "loanListed",
  "loaned",
  "shortlisted",
  "clubWillSell",
] as const satisfies readonly FlagKey[];

export interface PlayerFilters {
  /** Part of the name, ignoring case and diacritics. */
  readonly text?: string;
  readonly ranges?: { readonly [K in RangeKey]?: Range | undefined };
  readonly lists?: { readonly [K in ListKey]?: readonly NonNullable<Player[K]>[] | undefined };
  /** true: the list keeps everyone but its chosen values. */
  readonly excludedLists?: { readonly [K in ListKey]?: boolean | undefined };
  /** true: the player has it; false: he does not. */
  readonly flags?: { readonly [K in FlagKey]?: boolean | undefined };
  /** OVR at one position code, whatever the preferred position. */
  readonly positionRating?: PositionRating;
  readonly freeAgentsOnly?: boolean;
  /** Players one can sign: with a club, free agents and academy youth; leaves out legends and
   * national-team-only players. */
  readonly availableOnly?: boolean;
  /** Leaves out the user's club (its players and the academy youth). */
  readonly excludeTeamId?: number;
  /** Keeps only the user's club (its players and the academy youth). */
  readonly onlyTeamId?: number;
}

export interface PositionRating extends Range {
  readonly code: number;
  /** The OVR at the code minus the OVR at the preferred position. */
  readonly gain?: Range;
}

/** The OVR at a position code minus the OVR at the preferred position, or null without that rating. */
export const ratingGain = (player: Player, code: number): number | null => {
  const rating = player.overallByCode[code];
  return rating === undefined ? null : rating - player.overall;
};

type Predicate = (player: Player) => boolean;

/** A player's value for a range filter: a field, or an attribute. */
export const rangeValue = (player: Player, key: RangeKey): number | null =>
  isAttributeName(key) ? player.attributes[key] : player[key];

const hasFlag = (player: Player, flag: FlagKey): boolean => {
  if (flag === "nationalTeam") return player.nationalTeamId !== null;
  if (flag === "shortlisted") return player.shortlisted;
  if (flag === "clubWillSell") return player.clubWillSell === true;
  if (flag === "loaned") return player.loanedFromId !== null;
  if (flag === "loanListed") return player.loanListed;
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

/** One a club can sign: with a club, a free agent or academy youth; not a legend or national-team-only. */
const isAvailable = (player: Player): boolean =>
  player.clubId !== null || player.youth || player.freeAgent;

/** In the user's club: linked to it, or a youth-pool player without a club, who sits in its academy. */
const inClub = (player: Player, teamId: number): boolean =>
  player.clubId === teamId || (player.clubId === null && player.youth && !player.freeAgent);

const predicates = (filters: PlayerFilters): readonly Predicate[] => {
  const text = searchKey(filters.text?.trim() ?? "");
  const { excludeTeamId, onlyTeamId } = filters;
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
      const excluded = filters.excludedLists?.[key] === true;
      return values.length === 0 ? [] : [(player: Player) => wanted.has(player[key]) !== excluded];
    }),
    ...(rating === undefined
      ? []
      : [inRange(rating, (player) => player.overallByCode[rating.code])]),
    ...(rating?.gain === undefined
      ? []
      : [inRange(rating.gain, (player) => ratingGain(player, rating.code))]),
    ...FLAG_KEYS.flatMap((flag) => {
      const wanted = filters.flags?.[flag];
      return wanted === undefined ? [] : [(player: Player) => hasFlag(player, flag) === wanted];
    }),
    ...(filters.freeAgentsOnly === true ? [(player: Player) => player.freeAgent] : []),
    ...(filters.availableOnly === true ? [isAvailable] : []),
    ...(excludeTeamId === undefined ? [] : [(player: Player) => !inClub(player, excludeTeamId)]),
    ...(onlyTeamId === undefined ? [] : [(player: Player) => inClub(player, onlyTeamId)]),
  ];
};

/** The attributes with a set range, in the order they were added: the list shows them as columns. */
export const isRangeKey = (key: string): key is RangeKey =>
  RANGE_KEYS.some((candidate) => candidate === key);

/** The range filters that set a bound, in the order they were added. */
export const rangedKeys = (ranges: PlayerFilters["ranges"]): readonly RangeKey[] =>
  Object.entries(ranges ?? {}).flatMap(([key, range]) => {
    const found = RANGE_KEYS.find((candidate) => candidate === key);
    return found !== undefined && (range?.min !== undefined || range?.max !== undefined)
      ? [found]
      : [];
  });

export const rangedAttributes = (ranges: PlayerFilters["ranges"]): readonly AttributeName[] =>
  rangedKeys(ranges).filter(isAttributeName);

/** The players that pass every set filter; empty filters return all of them. */
export const filterPlayers = (
  players: readonly Player[],
  filters: PlayerFilters,
): readonly Player[] => {
  const active = predicates(filters);
  return players.filter((player) => active.every((predicate) => predicate(player)));
};
