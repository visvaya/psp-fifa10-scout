// The app state as a reducer with pure transitions, and the pure view helpers the screens share.
import { SCOUT_CONFIG } from "./config.ts";
import type { PlayerFilters } from "./filter-players.ts";
import type { LoadError, LoadPhase } from "./load-scout.ts";
import { nameCollator } from "./players.ts";
import type { Player } from "./players.ts";
import type { SortDirection, SortKey } from "./sort-players.ts";

/** The filters as the user sets them; "exclude my club" becomes a club id only with a career. */
export type ScoutFilters = Omit<PlayerFilters, "excludeTeamId"> & {
  readonly excludeMyClub?: boolean;
};
export type FilterKey = keyof ScoutFilters;

export interface ScoutSort {
  readonly key: SortKey;
  readonly direction: SortDirection;
}

export interface Preferences {
  readonly filters: ScoutFilters;
  readonly sort: ScoutSort;
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
  | { readonly type: "filters-changed"; readonly filters: ScoutFilters }
  | { readonly type: "filter-removed"; readonly key: FilterKey }
  | { readonly type: "filters-reset" }
  | { readonly type: "sort-changed"; readonly key: SortKey }
  | { readonly type: "preferences-restored"; readonly preferences: Preferences }
  | { readonly type: "player-opened"; readonly id: number }
  | { readonly type: "player-closed" };

export const DEFAULT_SORT: ScoutSort = { key: "potential", direction: "descending" };

export const initialScoutState: ScoutState = {
  players: null,
  myTeamId: null,
  loading: null,
  error: null,
  view: "start",
  openPlayerId: null,
  filters: {},
  sort: DEFAULT_SORT,
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

const isSet = (value: ScoutFilters[FilterKey]): boolean => {
  if (value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.values(value).some((item) => item !== undefined);
  return true;
};

const FILTER_KEYS: readonly FilterKey[] = [
  "text",
  "positionGroups",
  "age",
  "potential",
  "attributeMin",
  "leagueIds",
  "teamIds",
  "nationalityIds",
  "contractEndsBy",
  "freeAgentsOnly",
  "excludeMyClub",
];

/** The filters that narrow the list, in a fixed order (for chips and the count on the button). */
export const activeFilterKeys = (filters: ScoutFilters): readonly FilterKey[] =>
  FILTER_KEYS.filter((key) => isSet(filters[key]));

/** Only the active filters, so empty values never linger in state or storage. */
const compact = (filters: ScoutFilters): ScoutFilters =>
  Object.fromEntries(activeFilterKeys(filters).map((key) => [key, filters[key]]));

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
      return { ...state, filters: compact({ ...state.filters, ...action.filters }) };
    case "filter-removed":
      return { ...state, filters: compact({ ...state.filters, [action.key]: undefined }) };
    case "filters-reset":
      return { ...state, filters: {}, sort: DEFAULT_SORT };
    case "sort-changed":
      return {
        ...state,
        sort: { key: action.key, direction: nextDirection(state.sort, action.key) },
      };
    case "preferences-restored":
      return {
        ...state,
        filters: compact(action.preferences.filters),
        sort: action.preferences.sort,
      };
    case "player-opened":
      return { ...state, openPlayerId: action.id };
    case "player-closed":
    default:
      return { ...state, openPlayerId: null };
  }
};

/** The filters filterPlayers takes. */
export const effectiveFilters = (
  { excludeMyClub, ...filters }: ScoutFilters,
  myTeamId: number | null,
): PlayerFilters =>
  excludeMyClub === true && myTeamId !== null ? { ...filters, excludeTeamId: myTeamId } : filters;

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

/** The choices for the league, club, nationality and contract filters; clubs within the chosen leagues. */
export const facetOptions = (players: readonly Player[], filters: ScoutFilters) => {
  const leagues = new Set(filters.leagueIds ?? []);
  const inLeagues = players.filter(
    (player) => leagues.size === 0 || (player.leagueId !== null && leagues.has(player.leagueId)),
  );
  return {
    leagues: options(players.map((player) => [player.leagueId, player.leagueName])),
    clubs: options(inLeagues.map((player) => [player.clubId, player.clubName])),
    nationalities: options(players.map((player) => [player.nationalityId, player.nationalityName])),
    contractYears: [...new Set(players.flatMap((player) => player.contractEndYear ?? []))].toSorted(
      (a, b) => a - b,
    ),
  };
};
