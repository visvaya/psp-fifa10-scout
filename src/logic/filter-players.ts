// Declarative player filters: each set filter adds one predicate, and a player must pass them all.
// Lists keep any of the chosen values, ranges are inclusive, flags require a trait or its absence.
import { ATTRIBUTE_NAMES, isAttributeName, TRAIT_NAMES } from "./attributes.ts";
import { searchKey } from "./player-names.ts";
import { SEASON_STAT_KEYS } from "./season-stats.ts";
import type { Player } from "./players.ts";
import type { AttributeName, TraitName } from "./attributes.ts";

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
  "clubStars",
  "leaguePrestige",
  "clubPrestige",
  "contractEndYear",
  "contractYearsLeft",
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
  "role",
  "squadState",
  "target",
  "peakTarget",
] as const satisfies readonly (keyof Player)[];

export type ListKey = (typeof LIST_FIELDS)[number];
export type FlagKey =
  | TraitName
  | "nationalTeam"
  | "retiring"
  | "transferListed"
  | "loanListed"
  | "loaned"
  | "clubWillSell";
export const FLAG_KEYS: readonly FlagKey[] = [
  ...TRAIT_NAMES,
  "nationalTeam",
  "retiring",
  "transferListed",
  "loanListed",
  "loaned",
  "clubWillSell",
];

/** Which players by club: one can sign them in a career (with a club, free or a junior), with a club,
 * free agents, or those one cannot (linked only to a national team). */
export const CLUB_STATUSES = ["available", "with-club", "free-agents", "unavailable"] as const;
export type ClubStatus = (typeof CLUB_STATUSES)[number];

/** On the game's shortlist, on the user's own list, on both or on neither. */
export const LIST_MEMBERSHIPS = ["game", "tool", "both", "none"] as const;
export type ListMembership = (typeof LIST_MEMBERSHIPS)[number];

/** Whether a list choice needs the game's shortlist, so a career save. */
export const needsShortlist = (choice: "any" | ListMembership | undefined): boolean =>
  choice === "game" || choice === "both";

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
  "clubWillSell",
] as const satisfies readonly FlagKey[];

/** The lists only a career save fills (roles.ts): without one every player has null. */
export const CAREER_LIST_KEYS = [
  "role",
  "squadState",
  "target",
  "peakTarget",
] as const satisfies readonly ListKey[];

/** The columns and sort keys only a career save fills, the peak at a chosen position among them. */
export const CAREER_SORT_KEYS = [
  ...CAREER_RANGE_KEYS,
  ...CAREER_FLAG_KEYS,
  ...CAREER_LIST_KEYS,
  "positionPeak",
] as const;

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
  /** The peak and its gain ranges count at the position where his peak is highest (best-peak.ts). */
  readonly peakAtBest?: boolean;
  readonly clubStatus?: ClubStatus;
  /** Whether a player is on the game's shortlist and the user's own list. */
  readonly onList?: ListMembership;
  /** Leaves out the user's club (its players and the academy youth). */
  readonly excludeTeamId?: number;
  /** Keeps only the user's club (its players and the academy youth). */
  readonly onlyTeamId?: number;
  /** The ids on the user's own watchlist, for the list choice; without them nobody is on it. */
  readonly myListIds?: ReadonlySet<number>;
}

export interface PositionRating extends Range {
  readonly code: number;
  /** The OVR at the code minus the OVR at the preferred position. */
  readonly gain?: Range;
  /** The peak OVR at the code; career only, shown with potential. */
  readonly peak?: Range;
  /** Only players whose highest OVR is at the code (a tie counts). */
  readonly bestOnly?: boolean;
}

/** Whether a range sets a bound. */
export const bounded = (range: Range | undefined): range is Range =>
  range?.min !== undefined || range?.max !== undefined;

/** The position rating without a gain or peak range that sets no bound, nor bestOnly unset. */
export const compactRating = ({
  gain,
  peak,
  bestOnly,
  ...rating
}: PositionRating): PositionRating => ({
  ...rating,
  ...(bounded(gain) ? { gain } : {}),
  ...(bounded(peak) ? { peak } : {}),
  ...(bestOnly === true ? { bestOnly } : {}),
});

/** The position code is where the player rates highest (a tie counts). */
const isBestAt = (player: Player, code: number): boolean =>
  (player.overallByCode[code] ?? -1) >= Math.max(...player.overallByCode);

/** The OVR at a position code minus the OVR at the preferred position, or null without that rating. */
export const ratingGain = (player: Player, code: number): number | null => {
  const rating = player.overallByCode[code];
  return rating === undefined ? null : rating - player.overall;
};

type Predicate = (player: Player) => boolean;

/**
 * The peak fields and their best-position twins. The state stores only the first of each pair; the twin
 * is what the ranges, the sort and the list columns read while peakAtBest is on.
 */
const PEAK_PAIRS = [
  ["peak", "bestPeak"],
  ["peakGain", "bestPeakGain"],
] as const;

export type PeakTwin = (typeof PEAK_PAIRS)[number][1];

/** The key a peak field has while peakAtBest is on or off (either twin may be given); others as they are. */
export const peakField = <K extends string>(
  key: K,
  peakAtBest: boolean,
): K | (typeof PEAK_PAIRS)[number][number] => {
  const pair = PEAK_PAIRS.find((twins) => twins.some((twin) => twin === key));
  return pair === undefined ? key : pair[peakAtBest ? 1 : 0];
};

/** The peak OVR at a position code, or null without a career. */
export const peakAt = (player: Player, code: number): number | null =>
  player.peakByCode[code] ?? null;

/** A player's value for a range filter: a field, or an attribute. */
export const rangeValue = (player: Player, key: RangeKey | PeakTwin): number | null =>
  isAttributeName(key) ? player.attributes[key] : player[key];

// A set: the sort asks it once per player.
const FLAG_KEY_SET: ReadonlySet<string> = new Set(FLAG_KEYS);

export const isFlagKey = (key: string): key is FlagKey => FLAG_KEY_SET.has(key);

/** A yes / no field's value for its column and sort; null where only a career save would tell. */
export const flagValue = (player: Player, flag: FlagKey): boolean | null => {
  if (flag === "nationalTeam") return player.nationalTeamId !== null;
  if (flag === "retiring") return player.retiring;
  if (flag === "clubWillSell") return player.clubWillSell;
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

/**
 * One a club can sign: with a club, a free agent or a junior (of the academy, or scouted and not signed);
 * not a legend or national-team-only.
 */
const isAvailable = (player: Player): boolean =>
  player.clubId !== null || player.youth || player.freeAgent;

const CLUB_STATUS_TESTS: Readonly<Record<ClubStatus, Predicate>> = {
  available: isAvailable,
  "with-club": (player) => player.clubId !== null,
  "free-agents": (player) => player.freeAgent,
  unavailable: (player) => !isAvailable(player),
};

/** Keeps players by the lists they are on: the game's shortlist and the user's own list. */
const onLists =
  (membership: ListMembership, myListIds: ReadonlySet<number> | undefined): Predicate =>
  (player) => {
    const [game, tool] = [player.shortlisted, myListIds?.has(player.id) ?? false];
    if (membership === "game") return game;
    if (membership === "tool") return tool;
    return membership === "both" ? game && tool : !game && !tool;
  };

/** The user's player: linked to his club, a junior of its academy, or on loan from it at another club. */
export const inClub = (player: Player, teamId: number): boolean =>
  player.clubId === teamId || player.academy || player.loanedFromId === teamId;

const predicates = (filters: PlayerFilters): readonly Predicate[] => {
  const text = searchKey(filters.text?.trim() ?? "");
  const { excludeTeamId, onlyTeamId, clubStatus, onList } = filters;
  const rating = filters.positionRating;
  const peakAtBest = filters.peakAtBest === true;
  return [
    ...(text === "" ? [] : [(player: Player) => player.searchName.includes(text)]),
    ...RANGE_KEYS.flatMap((key) => {
      const range = filters.ranges?.[key];
      const field = peakField(key, peakAtBest);
      return range === undefined ? [] : [inRange(range, (player) => rangeValue(player, field))];
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
    ...(rating?.bestOnly === true ? [(player: Player) => isBestAt(player, rating.code)] : []),
    ...(rating?.peak === undefined
      ? []
      : [inRange(rating.peak, (player) => peakAt(player, rating.code))]),
    ...FLAG_KEYS.flatMap((flag) => {
      const wanted = filters.flags?.[flag];
      // An unknown value counts as no, as the filter always had it.
      return wanted === undefined
        ? []
        : [(player: Player) => (flagValue(player, flag) === true) === wanted];
    }),
    ...(clubStatus === undefined ? [] : [CLUB_STATUS_TESTS[clubStatus]]),
    ...(onList === undefined ? [] : [onLists(onList, filters.myListIds)]),
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
    return found !== undefined && bounded(range) ? [found] : [];
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
