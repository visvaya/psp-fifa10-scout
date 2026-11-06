// The app state as a reducer with pure transitions, and the pure view helpers the screens share.
import { SCOUT_CONFIG } from "./config.ts";
import {
  bounded,
  CAREER_FLAG_KEYS,
  CAREER_RANGE_KEYS,
  filterPlayers,
  FLAG_KEYS,
  isRangeKey,
  LIST_FIELDS,
  RANGE_KEYS,
  compactRating,
  peakField,
} from "./filter-players.ts";
import type { FlagKey, ListKey, PlayerFilters, RangeKey } from "./filter-players.ts";
import { defaultLanguage } from "./game-names.ts";
import type { GameLanguages } from "./game-names.ts";
import type { CareerSummary, LoadError, LoadPhase, WorkerMessage } from "./load-scout.ts";
import type { Player } from "./players.ts";
import { nextDirection, POTENTIAL_KEYS, RATING_SORT_KEYS } from "./sort-players.ts";
import type { SortDirection, SortKey } from "./sort-players.ts";
import { filterSetsAfter } from "./saved-filters.ts";
import { withUndo } from "./undo.ts";
import { columnReducer, isColumnAction } from "./column-preference.ts";
import type { ColumnAction, ColumnPreference } from "./column-preference.ts";
import { effectiveFilters } from "./effective-filters.ts";
import { isWatchlistAction, watchedIds, watchlistReducer } from "./watchlist.ts";
import type { WatchEntry, WatchlistAction } from "./watchlist.ts";
import type { UndoAction, UndoStep } from "./undo.ts";
import type { FilterSet, FilterSetAction } from "./saved-filters.ts";

/** Which players by club: unset means "available", everyone one can sign; free agents need a career. */
export type ClubStatus = "available" | "free-agents";

/** The user's club in the list: unset shows it with everyone, "hide" leaves it out, "only" keeps it alone. */
export type MyClub = "hide" | "only";

/** The filters as the user sets them; "my club" becomes a club id only with a career. */
export type ScoutFilters = Omit<
  PlayerFilters,
  "excludeTeamId" | "onlyTeamId" | "freeAgentsOnly" | "availableOnly"
> & {
  readonly clubStatus?: ClubStatus;
  readonly myClub?: MyClub;
};
type FilterKey = keyof ScoutFilters;
/** A change to some filters; undefined clears one. */
export type FilterChange = { readonly [K in FilterKey]?: ScoutFilters[K] | undefined };
/** One filter as the chips show it: a top-level key, or one entry of the ranges, lists or flags. */
export type FilterId =
  | "text"
  | "clubStatus"
  | "myClub"
  | "positionRating"
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
  /** The game language of club, league and country names; null the fifa.db names, unset the browser's. */
  readonly gameLanguage?: string | null;
  /** Filters and sort saved under a name; unset as none. */
  readonly filterSets?: readonly FilterSet[];
  /** A view setting, kept out of the filters, the sets and undo; unset as none. */
  readonly columns?: ColumnPreference;
}

export type ScoutError =
  | LoadError
  | { readonly stage: "save" | "locale"; readonly kind: "missing-file" };

export interface ScoutState extends Preferences {
  /** The states before the user's last changes, newest first (undo.ts). */
  readonly undo: readonly UndoStep[];
  readonly players: readonly Player[] | null;
  readonly myTeamId: number | null;
  readonly career: CareerSummary | null;
  readonly loading: {
    readonly requestId: number;
    readonly phase: LoadPhase;
    /** The stored game loads on start; it opens the list, while a picked file stays on the start view. */
    readonly restored: boolean;
    /** The game file's name; null for a stored game saved without one, unset keeps the current. */
    readonly gameName?: string | null;
  } | null;
  /** The name of the loaded game file, null when unknown. */
  readonly gameName: string | null;
  readonly error: ScoutError | null;
  readonly view: "start" | "list";
  readonly openPlayerId: number | null;
  /** The names of each game language read so far. */
  readonly languages: GameLanguages;
  /** The user's own watchlist, kept apart from the preferences and from undo. */
  readonly watchlist: readonly WatchEntry[];
  /** The user changed the list since it was restored; only then is it saved. */
  readonly watchlistEdited: boolean;
}

type LoadAction =
  | {
      readonly type: "load-started";
      readonly requestId: number;
      readonly restored?: true;
      readonly gameName?: string | null;
    }
  | { readonly type: "load-phase"; readonly requestId: number; readonly phase: LoadPhase }
  | {
      readonly type: "load-succeeded";
      readonly requestId: number;
      readonly players: readonly Player[];
      readonly myTeamId: number | null;
      readonly career: CareerSummary | null;
      readonly languages: GameLanguages;
      /** An attached language file's code; it becomes the chosen language. */
      readonly attachedLanguage: string | null;
    }
  | { readonly type: "load-failed"; readonly requestId: number; readonly error: LoadError };

export type ScoutAction =
  | LoadAction
  | UndoAction
  | { readonly type: "files-incomplete"; readonly stage: "save" | "locale" }
  | { readonly type: "languages-restored"; readonly languages: GameLanguages }
  | { readonly type: "language-chosen"; readonly language: string | null }
  | { readonly type: "view-changed"; readonly view: ScoutState["view"] }
  | { readonly type: "filters-changed"; readonly filters: FilterChange }
  | { readonly type: "filter-removed"; readonly id: FilterId }
  | { readonly type: "potential-shown"; readonly shown: boolean }
  | { readonly type: "filters-reset" }
  /** Filters, sort, columns and the potential switch back to their defaults; files, language and sets kept. */
  | { readonly type: "settings-reset" }
  | { readonly type: "sort-changed"; readonly key: SortKey }
  | { readonly type: "preferences-restored"; readonly preferences: Preferences }
  | FilterSetAction
  | WatchlistAction
  | ColumnAction
  | { readonly type: "player-opened"; readonly id: number }
  | { readonly type: "player-closed" };

export const DEFAULT_SORT: ScoutSort = { key: "overall", direction: "descending" };

export const initialScoutState: ScoutState = {
  undo: [],
  players: null,
  myTeamId: null,
  career: null,
  gameName: null,
  loading: null,
  error: null,
  view: "start",
  openPlayerId: null,
  filters: {},
  sort: DEFAULT_SORT,
  showPotential: false,
  languages: {},
  watchlist: [],
  watchlistEdited: false,
};

/** The known keys in the order the record holds them: the order filters were added orders the columns. */
export const inRecordOrder = <K extends PropertyKey>(keys: readonly K[], record: object): K[] => {
  const order = Object.keys(record);
  return keys.toSorted((a, b) => order.indexOf(String(a)) - order.indexOf(String(b)));
};

/** The entries of `keys` in `record` whose value passes `keep`, or undefined when none does. */
const pick = <T extends object>(
  record: T | undefined,
  keys: readonly (keyof T)[],
  keep: (value: NonNullable<T[keyof T]>) => boolean,
): Partial<T> | undefined => {
  const kept: Partial<T> = {};
  for (const key of inRecordOrder(keys, record ?? {})) {
    const item = record?.[key];
    if (item !== undefined && item !== null && keep(item)) kept[key] = item;
  }
  return Object.keys(kept).length === 0 ? undefined : kept;
};

const isNonEmpty = (values: readonly unknown[] | undefined): boolean =>
  values !== undefined && values.length > 0;
const isDefined = (value: unknown): boolean => value !== undefined;

/** Each filter that narrows the list, in a fixed order (for chips and the count on the button). */
export const activeFilters = (filters: FilterChange): readonly FilterId[] => [
  ...(filters.text === undefined || filters.text.trim() === "" ? [] : ["text" as const]),
  ...RANGE_KEYS.filter((key) => bounded(filters.ranges?.[key])).map(
    (key) => `ranges.${key}` as const,
  ),
  ...(filters.positionRating === undefined ? [] : ["positionRating" as const]),
  ...LIST_FIELDS.filter((key) => isNonEmpty(filters.lists?.[key])).map(
    (key) => `lists.${key}` as const,
  ),
  ...FLAG_KEYS.filter((key) => isDefined(filters.flags?.[key])).map(
    (key) => `flags.${key}` as const,
  ),
  ...(filters.clubStatus === "free-agents" ? ["clubStatus" as const] : []),
  ...(filters.myClub === undefined ? [] : ["myClub" as const]),
];

/** Only the active filters, so empty values never linger in state or storage. */
export const compactFilters = (filters: FilterChange): ScoutFilters => {
  const { text, clubStatus, myClub, positionRating, peakAtBest } = filters;
  const ranges = pick(filters.ranges, RANGE_KEYS, bounded);
  const lists = pick(filters.lists, LIST_FIELDS, isNonEmpty);
  // An exclusion means nothing without its list's values.
  const excludedLists = pick(
    filters.excludedLists,
    LIST_FIELDS.filter((key) => lists?.[key] !== undefined),
    (excluded) => excluded,
  );
  const flags = pick(filters.flags, FLAG_KEYS, isDefined);
  return {
    ...(text === undefined || text.trim() === "" ? {} : { text }),
    ...(ranges === undefined ? {} : { ranges }),
    ...(positionRating === undefined ? {} : { positionRating: compactRating(positionRating) }),
    ...(peakAtBest === true ? { peakAtBest } : {}),
    ...(lists === undefined ? {} : { lists }),
    ...(excludedLists === undefined ? {} : { excludedLists }),
    ...(flags === undefined ? {} : { flags }),
    ...(clubStatus === "free-agents" ? { clubStatus } : {}),
    ...(myClub === undefined ? {} : { myClub }),
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

/** The position rating filter without its peak range, which needs a career and potential shown. */
const withoutRatingPeak = (filters: ScoutFilters): FilterChange => {
  const { positionRating } = filters;
  if (positionRating?.peak === undefined) return filters;
  const { peak: _peak, ...rest } = positionRating;
  return { ...filters, positionRating: rest };
};

/** Preferences without potential filters and sort when potential is hidden. */
const withPotential = (preferences: Preferences): Preferences => {
  if (preferences.showPotential) return preferences;
  const ranges = {
    ...preferences.filters.ranges,
    ...Object.fromEntries([...POTENTIAL_KEYS].filter(isRangeKey).map((key) => [key, undefined])),
  };
  return {
    ...preferences,
    filters: compactFilters({
      ...withoutRatingPeak(preferences.filters),
      peakAtBest: undefined,
      ranges,
    }),
    sort: POTENTIAL_KEYS.has(preferences.sort.key) ? DEFAULT_SORT : preferences.sort,
  };
};

/** Preferences whose sort fits the filters: by position rating only while a position is chosen. */
const consistent = (preferences: Preferences): Preferences => {
  const shown = withPotential(preferences);
  return RATING_SORT_KEYS.has(shown.sort.key) && shown.filters.positionRating === undefined
    ? { ...shown, sort: DEFAULT_SORT }
    : shown;
};

const isLoadAction = (action: ScoutAction): action is LoadAction => action.type.startsWith("load-");

/** The stored preferences over the state, made consistent; after a game without a career, without what needs one. */
const withPreferences = (state: ScoutState, preferences: Preferences): ScoutState => {
  const { filters, sort, showPotential, gameLanguage, filterSets, columns } = preferences;
  const restored = { filters: compactFilters(filters), sort };
  const fitted =
    state.players !== null && state.myTeamId === null ? withoutCareer(restored) : restored;
  return {
    ...state,
    ...consistent({ ...fitted, showPotential }),
    ...(gameLanguage === undefined ? {} : { gameLanguage }),
    ...(filterSets === undefined ? {} : { filterSets }),
    ...(columns === undefined ? {} : { columns }),
  };
};

/**
 * The filters and sort without what needs a career: without one they do nothing, so they would leave a
 * chip that does not apply or a sort the list cannot show.
 */
const withoutCareer = ({ filters, sort }: Pick<Preferences, "filters" | "sort">) => ({
  filters: compactFilters({
    ...withoutRatingPeak(filters),
    peakAtBest: undefined,
    clubStatus: undefined,
    myClub: undefined,
    ranges: {
      ...filters.ranges,
      ...Object.fromEntries(CAREER_RANGE_KEYS.map((key) => [key, undefined])),
    },
    flags: {
      ...filters.flags,
      ...Object.fromEntries(CAREER_FLAG_KEYS.map((key) => [key, undefined])),
    },
  }),
  sort:
    sort.key === "positionPeak" || CAREER_RANGE_KEYS.some((key) => key === sort.key)
      ? DEFAULT_SORT
      : sort,
});

/** A filter set's action; a set loaded without a career leaves out what needs one, the set itself kept. */
const withFilterSets = (state: ScoutState, action: FilterSetAction): ScoutState => {
  const next = filterSetsAfter(state, action);
  const fitted =
    action.type === "filter-set-loaded" && state.myTeamId === null
      ? { ...next, ...withoutCareer(next) }
      : next;
  return { ...state, ...consistent(fitted) };
};

const isFilterSetAction = (action: ScoutAction): action is FilterSetAction =>
  action.type.startsWith("filter-set-");

const loadReducer = (state: ScoutState, action: LoadAction): ScoutState => {
  if (action.type === "load-started") {
    const { requestId, restored, gameName } = action;
    const loading = { requestId, phase: "game" as const, restored: restored === true };
    return {
      ...state,
      loading: gameName === undefined ? loading : { ...loading, gameName },
      error: null,
    };
  }
  const { loading } = state;
  if (loading?.requestId !== action.requestId) return state;
  switch (action.type) {
    case "load-phase":
      return { ...state, loading: { ...loading, phase: action.phase } };
    case "load-succeeded":
      return {
        ...state,
        players: action.players,
        myTeamId: action.myTeamId,
        career: action.career,
        ...(action.myTeamId === null ? withoutCareer(state) : {}),
        gameName: loading.gameName === undefined ? state.gameName : loading.gameName,
        languages: { ...state.languages, ...action.languages },
        ...(action.attachedLanguage === null ? {} : { gameLanguage: action.attachedLanguage }),
        loading: null,
        view: loading.restored ? "list" : state.view,
        openPlayerId: null,
      };
    case "load-failed":
    default:
      return { ...state, loading: null, error: action.error };
  }
};

/** What each reset sets: the filters and sort, or with the potential switch too ("Resetuj", which also drops the columns). */
const RESETS = {
  "filters-reset": { filters: {}, sort: DEFAULT_SORT },
  "settings-reset": { filters: {}, sort: DEFAULT_SORT, showPotential: false },
} as const;

type ResetAction = Extract<ScoutAction, { readonly type: keyof typeof RESETS }>;

const isResetAction = (action: ScoutAction): action is ResetAction => action.type in RESETS;

/**
 * The state after a reset; "Resetuj" also brings the columns back to the automatic choice. The settings
 * alone are enough for it, so canResetSettings (settings-reset.ts) asks the reset itself.
 */
export const resetState = <S extends Pick<ScoutState, "columns">>(
  state: S,
  type: ResetAction["type"],
) => {
  const { columns: _columns, ...kept } = state;
  return { ...(type === "settings-reset" ? kept : state), ...RESETS[type] };
};

const changes = (
  state: ScoutState,
  action: Exclude<ScoutAction, UndoAction | WatchlistAction | ColumnAction>,
): ScoutState => {
  if (isLoadAction(action)) return loadReducer(state, action);
  if (isFilterSetAction(action)) return withFilterSets(state, action);
  if (isResetAction(action)) return resetState(state, action.type);
  switch (action.type) {
    case "files-incomplete":
      return { ...state, error: { stage: action.stage, kind: "missing-file" } };
    case "languages-restored":
      return { ...state, languages: { ...state.languages, ...action.languages } };
    case "language-chosen":
      return { ...state, gameLanguage: action.language };
    case "view-changed":
      return { ...state, view: action.view };
    case "filters-changed":
      return {
        ...state,
        ...consistent({
          ...state,
          filters: compactFilters({ ...state.filters, ...action.filters }),
        }),
      };
    case "filter-removed":
      return {
        ...state,
        ...consistent({ ...state, filters: withoutFilter(state.filters, action.id) }),
      };
    case "potential-shown":
      return { ...state, ...consistent({ ...state, showPotential: action.shown }) };
    case "sort-changed": {
      // A best-peak column sorts the stored peak: the list maps it back by the filters' mode.
      const key = peakField(action.key, false);
      return { ...state, sort: { key, direction: nextDirection(state.sort, key) } };
    }
    case "preferences-restored":
      return withPreferences(state, action.preferences);

    case "player-opened":
      return { ...state, openPlayerId: action.id };
    case "player-closed":
    default:
      return { ...state, openPlayerId: null };
  }
};

/** The state after an action, with undo for the user's changes. */
export const scoutReducer = withUndo((state, action) => {
  if (isWatchlistAction(action)) return watchlistReducer(state, action);
  return isColumnAction(action) ? columnReducer(state, action) : changes(state, action);
});

/** The stored game is loading and nothing shows yet: the list skeleton stands in for it. */
export const isRestoring = ({ loading, players }: ScoutState): boolean =>
  loading?.restored === true && players === null;

/** The reducer action for a worker message. */
export const actionOf = (message: WorkerMessage): ScoutAction => {
  const { requestId } = message;
  if (message.type === "phase") return { type: "load-phase", requestId, phase: message.phase };
  if (message.type === "failed") return { type: "load-failed", requestId, error: message.error };
  const { gameDb: _gameDb, ...result } = message.result;
  return { type: "load-succeeded", requestId, ...result };
};

/** The game language whose names show: the chosen one while known, else the browser's, else none. */
export const activeLanguage = (
  { gameLanguage, languages }: Pick<ScoutState, "gameLanguage" | "languages">,
  browserLanguages: readonly string[],
): string | null => {
  if (gameLanguage === undefined) return defaultLanguage(Object.keys(languages), browserLanguages);
  return gameLanguage !== null && Object.hasOwn(languages, gameLanguage) ? gameLanguage : null;
};

export type AttributeBand = "high" | "good" | "average" | "low";

/** The FIFA colour band of an attribute or potential value. */
export const attributeBand = (value: number): AttributeBand => {
  const { high, good, average } = SCOUT_CONFIG.attributeBandMin;
  if (value >= high) return "high";
  if (value >= good) return "good";
  return value >= average ? "average" : "low";
};

/** How many players the list shows with the current filters, for the start screen's button. */
export const listedCount = (state: ScoutState): number =>
  state.players === null
    ? 0
    : filterPlayers(
        state.players,
        effectiveFilters(state.filters, state.myTeamId, watchedIds(state.watchlist)),
      ).length;
