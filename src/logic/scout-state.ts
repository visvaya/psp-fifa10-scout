// The app state as a reducer with pure transitions, and the pure view helpers the screens share.
import { SCOUT_CONFIG } from "./config.ts";
import { FLAG_KEYS, LIST_FIELDS, RANGE_KEYS } from "./filter-players.ts";
import type { FlagKey, ListKey, PlayerFilters, Range, RangeKey } from "./filter-players.ts";
import type { LoadError, LoadPhase, WorkerMessage } from "./load-scout.ts";
import { nameCollator } from "./players.ts";
import type { Player } from "./players.ts";
import type { SortDirection, SortKey } from "./sort-players.ts";

/** Which players by club: unset means "with-club", the default that hides clubless players. */
export type ClubStatus = "with-club" | "all" | "free-agents";

/** The filters as the user sets them; "exclude my club" becomes a club id only with a career. */
export type ScoutFilters = Omit<
  PlayerFilters,
  "excludeTeamId" | "freeAgentsOnly" | "withClubOnly"
> & {
  readonly clubStatus?: ClubStatus;
  readonly excludeMyClub?: boolean;
};
type FilterKey = keyof ScoutFilters;
/** A change to some filters; undefined clears one. */
export type FilterChange = { readonly [K in FilterKey]?: ScoutFilters[K] | undefined };
/** One filter as the chips show it: a top-level key, or one entry of the ranges, lists or flags. */
export type FilterId =
  | "text"
  | "clubStatus"
  | "excludeMyClub"
  | `ranges.${RangeKey}`
  | `lists.${ListKey}`
  | `flags.${FlagKey}`;

export interface ScoutSort {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export interface Preferences {
  readonly filters: ScoutFilters;
  readonly sort: ScoutSort;
  /** Potential, growth room and their filters and sort show only when the user asks. */
  readonly showPotential: boolean;
}

export type ScoutError = LoadError | { readonly stage: "save"; readonly kind: "missing-file" };

export interface ScoutState extends Preferences {
  readonly players: readonly Player[] | null;
  readonly myTeamId: number | null;
  readonly loading: { readonly requestId: number; readonly phase: LoadPhase } | null;
  readonly error: ScoutError | null;
  readonly view: "start" | "list";
  readonly openPlayerId: number | null;
}

type LoadAction =
  | { readonly type: "load-started"; readonly requestId: number }
  | { readonly type: "load-phase"; readonly requestId: number; readonly phase: LoadPhase }
  | {
      readonly type: "load-succeeded";
      readonly requestId: number;
      readonly players: readonly Player[];
      readonly myTeamId: number | null;
    }
  | { readonly type: "load-failed"; readonly requestId: number; readonly error: LoadError };

export type ScoutAction =
  | LoadAction
  | { readonly type: "save-incomplete" }
  | { readonly type: "view-changed"; readonly view: ScoutState["view"] }
  | { readonly type: "filters-changed"; readonly filters: FilterChange }
  | { readonly type: "filter-removed"; readonly id: FilterId }
  | { readonly type: "potential-shown"; readonly shown: boolean }
  | { readonly type: "filters-reset" }
  | { readonly type: "sort-changed"; readonly key: SortKey }
  | { readonly type: "preferences-restored"; readonly preferences: Preferences }
  | { readonly type: "player-opened"; readonly id: number }
  | { readonly type: "player-closed" };

export const DEFAULT_SORT: ScoutSort = { key: "overall", direction: "descending" };

/** The ranges and sort keys that reveal potential. */
const POTENTIAL_KEYS: ReadonlySet<SortKey> = new Set(["potential", "growth"]);

export const initialScoutState: ScoutState = {
  players: null,
  myTeamId: null,
  loading: null,
  error: null,
  view: "start",
  openPlayerId: null,
  filters: {},
  sort: DEFAULT_SORT,
  showPotential: false,
};

/** Keys whose first click sorts ascending (text, age, position, contract); numbers start high. */
const ASCENDING_FIRST = new Set<SortKey>([
  "name",
  "age",
  "positionCode",
  "clubName",
  "leagueName",
  "nationalityName",
  "contractEndYear",
]);

/** The entries of `keys` in `record` whose value passes `keep`, or undefined when none does. */
const pick = <T extends object>(
  record: T | undefined,
  keys: readonly (keyof T)[],
  keep: (value: NonNullable<T[keyof T]>) => boolean,
): Partial<T> | undefined => {
  const kept: Partial<T> = {};
  for (const key of keys) {
    const item = record?.[key];
    if (item !== undefined && item !== null && keep(item)) kept[key] = item;
  }
  return Object.keys(kept).length === 0 ? undefined : kept;
};

const isRangeSet = (range: Range | undefined): boolean =>
  range?.min !== undefined || range?.max !== undefined;
const isNonEmpty = (values: readonly unknown[] | undefined): boolean =>
  values !== undefined && values.length > 0;
const isDefined = (value: unknown): boolean => value !== undefined;

/** Each filter that narrows the list, in a fixed order (for chips and the count on the button). */
export const activeFilters = (filters: FilterChange): readonly FilterId[] => [
  ...(filters.text === undefined || filters.text.trim() === "" ? [] : ["text" as const]),
  ...RANGE_KEYS.filter((key) => isRangeSet(filters.ranges?.[key])).map(
    (key) => `ranges.${key}` as const,
  ),
  ...LIST_FIELDS.filter((key) => isNonEmpty(filters.lists?.[key])).map(
    (key) => `lists.${key}` as const,
  ),
  ...FLAG_KEYS.filter((key) => isDefined(filters.flags?.[key])).map(
    (key) => `flags.${key}` as const,
  ),
  ...(filters.clubStatus === undefined || filters.clubStatus === "with-club"
    ? []
    : ["clubStatus" as const]),
  ...(filters.excludeMyClub === true ? ["excludeMyClub" as const] : []),
];

/** Only the active filters, so empty values never linger in state or storage. */
export const compactFilters = (filters: FilterChange): ScoutFilters => {
  const { text, clubStatus, excludeMyClub } = filters;
  const ranges = pick(filters.ranges, RANGE_KEYS, isRangeSet);
  const lists = pick(filters.lists, LIST_FIELDS, isNonEmpty);
  const flags = pick(filters.flags, FLAG_KEYS, isDefined);
  return {
    ...(text === undefined || text.trim() === "" ? {} : { text }),
    ...(ranges === undefined ? {} : { ranges }),
    ...(lists === undefined ? {} : { lists }),
    ...(flags === undefined ? {} : { flags }),
    ...(clubStatus === undefined || clubStatus === "with-club" ? {} : { clubStatus }),
    ...(excludeMyClub === true ? { excludeMyClub } : {}),
  };
};

/** The filters without one of them. */
const withoutFilter = (filters: ScoutFilters, id: FilterId): ScoutFilters => {
  const [group, key = ""] = id.split(".");
  if (group === "ranges")
    return compactFilters({ ...filters, ranges: { ...filters.ranges, [key]: undefined } });
  if (group === "lists")
    return compactFilters({ ...filters, lists: { ...filters.lists, [key]: undefined } });
  if (group === "flags")
    return compactFilters({ ...filters, flags: { ...filters.flags, [key]: undefined } });
  return compactFilters({ ...filters, [id]: undefined });
};

/** Preferences without potential filters and sort when potential is hidden. */
const withPotential = (preferences: Preferences): Preferences => {
  if (preferences.showPotential) return preferences;
  const ranges = { ...preferences.filters.ranges, potential: undefined, growth: undefined };
  return {
    ...preferences,
    filters: compactFilters({ ...preferences.filters, ranges }),
    sort: POTENTIAL_KEYS.has(preferences.sort.key) ? DEFAULT_SORT : preferences.sort,
  };
};

const isCurrent = (state: ScoutState, requestId: number): boolean =>
  state.loading?.requestId === requestId;

const isLoadAction = (action: ScoutAction): action is LoadAction => action.type.startsWith("load-");

const nextDirection = (sort: ScoutSort, key: SortKey): SortDirection => {
  if (sort.key === key) return sort.direction === "ascending" ? "descending" : "ascending";
  return ASCENDING_FIRST.has(key) ? "ascending" : "descending";
};

const loadReducer = (state: ScoutState, action: LoadAction): ScoutState => {
  switch (action.type) {
    case "load-started":
      return { ...state, loading: { requestId: action.requestId, phase: "game" }, error: null };
    case "load-phase":
      return isCurrent(state, action.requestId)
        ? { ...state, loading: { requestId: action.requestId, phase: action.phase } }
        : state;
    case "load-succeeded":
      return isCurrent(state, action.requestId)
        ? {
            ...state,
            players: action.players,
            myTeamId: action.myTeamId,
            loading: null,
            view: "list",
            openPlayerId: null,
          }
        : state;
    case "load-failed":
    default:
      return isCurrent(state, action.requestId)
        ? { ...state, loading: null, error: action.error }
        : state;
  }
};

export const scoutReducer = (state: ScoutState, action: ScoutAction): ScoutState => {
  if (isLoadAction(action)) return loadReducer(state, action);
  switch (action.type) {
    case "save-incomplete":
      return { ...state, error: { stage: "save", kind: "missing-file" } };
    case "view-changed":
      return { ...state, view: action.view };
    case "filters-changed":
      return { ...state, filters: compactFilters({ ...state.filters, ...action.filters }) };
    case "filter-removed":
      return { ...state, filters: withoutFilter(state.filters, action.id) };
    case "potential-shown":
      return { ...state, ...withPotential({ ...state, showPotential: action.shown }) };
    case "filters-reset":
      return { ...state, filters: {}, sort: DEFAULT_SORT };
    case "sort-changed":
      return {
        ...state,
        sort: { key: action.key, direction: nextDirection(state.sort, action.key) },
      };
    case "preferences-restored": {
      const { filters, sort, showPotential } = action.preferences;
      return {
        ...state,
        ...withPotential({ filters: compactFilters(filters), sort, showPotential }),
      };
    }
    case "player-opened":
      return { ...state, openPlayerId: action.id };
    case "player-closed":
    default:
      return { ...state, openPlayerId: null };
  }
};

/** The reducer action for a worker message. */
export const actionOf = (message: WorkerMessage): ScoutAction => {
  const { requestId } = message;
  if (message.type === "phase") return { type: "load-phase", requestId, phase: message.phase };
  if (message.type === "failed") return { type: "load-failed", requestId, error: message.error };
  const { players, myTeamId } = message.result;
  return { type: "load-succeeded", requestId, players, myTeamId };
};

/** The filters filterPlayers takes. */
export const effectiveFilters = (
  { excludeMyClub, clubStatus, ...filters }: ScoutFilters,
  myTeamId: number | null,
): PlayerFilters => ({
  ...filters,
  ...(clubStatus === "all"
    ? {}
    : clubStatus === "free-agents"
      ? { freeAgentsOnly: true }
      : { withClubOnly: true }),
  ...(excludeMyClub === true && myTeamId !== null ? { excludeTeamId: myTeamId } : {}),
});

export type AttributeBand = "high" | "good" | "average" | "low";

/** The FIFA colour band of an attribute or potential value. */
export const attributeBand = (value: number): AttributeBand => {
  const { high, good, average } = SCOUT_CONFIG.attributeBandMin;
  if (value >= high) return "high";
  if (value >= good) return "good";
  return value >= average ? "average" : "low";
};

export interface FacetOption {
  readonly id: number;
  readonly name: string;
}

const options = (pairs: readonly (readonly [number | null, string | null])[]): FacetOption[] =>
  [
    ...new Map(
      pairs.flatMap(([id, name]) => (id === null || name === null ? [] : [[id, name] as const])),
    ),
  ]
    .map(([id, name]) => ({ id, name }))
    .toSorted((a, b) => nameCollator.compare(a.name, b.name));

const distinct = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].toSorted((a, b) => a - b);

/** The choices for the league, club, nationality and contract filters; clubs within the chosen leagues. */
export const facetOptions = (players: readonly Player[], filters: ScoutFilters) => {
  const leagues = new Set(filters.lists?.leagueId ?? []);
  const inLeagues = players.filter(
    (player) => leagues.size === 0 || (player.leagueId !== null && leagues.has(player.leagueId)),
  );
  return {
    leagues: options(players.map((player) => [player.leagueId, player.leagueName])),
    clubs: options(inLeagues.map((player) => [player.clubId, player.clubName])),
    nationalities: options(players.map((player) => [player.nationalityId, player.nationalityName])),
    contractYears: distinct(players.flatMap((player) => player.contractEndYear ?? [])),
    codes: {
      positionCode: distinct(players.map((player) => player.positionCode)),
      bodyType: distinct(players.map((player) => player.bodyType)),
      developmentType: distinct(players.map((player) => player.developmentType)),
      developmentStyle: distinct(players.map((player) => player.developmentStyle)),
    },
  };
};
