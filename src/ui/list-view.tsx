import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, JSX, ReactNode } from "react";
import { effectiveColumns, tableColumns } from "../logic/columns.ts";
import { filterPlayers, rangedAttributes } from "../logic/filter-players.ts";
import { phoneColumns } from "../logic/phone-columns.ts";
import type { Player } from "../logic/players.ts";
import { effectiveFilters } from "../logic/effective-filters.ts";
import { activeFilters } from "../logic/scout-state.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { SORTABLE_KEYS } from "../logic/scout-store.ts";
import { POTENTIAL_KEYS, RATING_SORT_KEYS, sortPlayers } from "../logic/sort-players.ts";
import type { SortKey } from "../logic/sort-players.ts";
import type { WatchEntry } from "../logic/watchlist.ts";
import { FilterChips } from "./filter-chips.tsx";
import { FilterForm } from "./filter-form.tsx";
import { FilterSets } from "./filter-sets.tsx";
import { ModalDialog } from "./modal-dialog.tsx";
import { columnLabel, PlayerTable, RESULTS_TITLE_ID } from "./player-list.tsx";
import { PlayerCards } from "./player-rows.tsx";
import { ratingAbbreviation } from "./position-name.tsx";
import { TEXT } from "./text.ts";

/** Wait before announcing a count, so typing in the search does not speak at every key. */
const ANNOUNCE_DELAY_MS = 600;

const ResultCount = ({ count }: { count: number }) => {
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnnounced(TEXT.resultCount(count));
    }, ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [count]);
  return (
    <>
      <p className="count" aria-hidden="true">
        {TEXT.resultCount(count)}
      </p>
      <output className="visually-hidden">{announced}</output>
    </>
  );
};

const SortControls = ({
  state,
  ratingName,
  dispatch,
}: {
  state: ScoutState;
  ratingName: string | null;
  dispatch: Dispatch<ScoutAction>;
}) => (
  <div className="sort-controls">
    <label className="field inline">
      <span>{TEXT.sortBy}</span>
      <select
        value={state.sort.key}
        onChange={(event) => {
          const key = SORTABLE_KEYS.find((item) => item === event.currentTarget.value);
          if (key !== undefined) dispatch({ type: "sort-changed", key });
        }}
      >
        {SORTABLE_KEYS.filter(
          (key) =>
            (state.showPotential || !POTENTIAL_KEYS.has(key)) &&
            ((key !== "peak" && key !== "positionPeak") || state.myTeamId !== null) &&
            (!RATING_SORT_KEYS.has(key) || state.filters.positionRating !== undefined),
        ).map((key) => (
          <option key={key} value={key}>
            {columnLabel(key, ratingName)}
          </option>
        ))}
      </select>
    </label>
    <button
      type="button"
      className="button"
      onClick={() => {
        dispatch({ type: "sort-changed", key: state.sort.key });
      }}
    >
      {state.sort.direction === "ascending" ? TEXT.sortAscending : TEXT.sortDescending}
    </button>
  </div>
);

const NoMatches = ({ dispatch }: { dispatch: Dispatch<ScoutAction> }) => (
  <div className="empty">
    <p>{TEXT.noMatches}</p>
    <button
      type="button"
      className="button"
      onClick={() => {
        dispatch({ type: "filters-reset" });
      }}
    >
      {TEXT.resetFilters}
    </button>
  </div>
);

const NO_ENTRIES: readonly WatchEntry[] = [];

/**
 * The ids on the watchlist, the same set while only a note changes, so typing a note does not filter and
 * sort every player again.
 */
const useWatchedIds = (watchlist: readonly WatchEntry[]): ReadonlySet<number> => {
  const key = watchlist.map((entry) => entry.playerId).join(",");
  return useMemo(() => new Set(key === "" ? [] : key.split(",").map(Number)), [key]);
};

/** The filtered and sorted players; deferred so typing stays responsive. */
const useVisiblePlayers = (
  players: readonly Player[],
  state: ScoutState,
  collator: Intl.Collator,
) => {
  const filters = useDeferredValue(state.filters);
  const sort = useDeferredValue(state.sort);
  // The list matters only while its filter is set, so adding a player with it off filters nothing again.
  const listed = useWatchedIds(
    filters.flags?.onMyList === undefined ? NO_ENTRIES : state.watchlist,
  );
  const visible = useMemo(
    () =>
      sortPlayers(
        filterPlayers(players, effectiveFilters(filters, state.myTeamId, listed)),
        sort.key,
        sort.direction,
        { ratingCode: filters.positionRating?.code, collator },
      ),
    [players, filters, sort, state.myTeamId, listed, collator],
  );
  return { visible, sort };
};

/**
 * The columns both the list and the filters' eyes go by: the layout's automatic ones with the user's
 * choice applied. Prices and peaks exist only in a career.
 */
const useColumns = (state: ScoutState, players: readonly Player[], wide: boolean) => {
  const { showPotential, columns, myTeamId, sort } = state;
  const { positionRating, ranges } = state.filters;
  const priced = useMemo(() => players.some((player) => player.price !== null), [players]);
  const projected = useMemo(() => players.some((player) => player.peak !== null), [players]);
  return useMemo(() => {
    const ratingCode = positionRating?.code ?? null;
    const automatic = wide
      ? tableColumns({
          ratingCode,
          showPotential,
          ranged: rangedAttributes(ranges),
          priced,
          projected,
        })
      : phoneColumns({
          showPotential,
          ratingCode,
          ratingPeakSet: positionRating?.peak !== undefined,
          ranges,
          sortKey: sort.key,
        });
    return effectiveColumns(automatic, columns, {
      showPotential,
      ratingCode,
      career: myTeamId !== null,
    });
  }, [wide, showPotential, columns, myTeamId, sort.key, positionRating, ranges, priced, projected]);
};

const FiltersDialogButton = ({ count, children }: { count: number; children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useCallback(() => buttonRef.current, []);
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="button primary"
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        {TEXT.filtersWithCount(count)}
      </button>
      {open ? (
        <ModalDialog
          title={TEXT.filters}
          className="sheet"
          returnFocus={returnFocus}
          onClose={() => {
            setOpen(false);
          }}
        >
          {children}
        </ModalDialog>
      ) : null}
    </>
  );
};

interface ListViewProps {
  readonly state: ScoutState;
  readonly players: readonly Player[];
  /** The order of club, league and country names in the chosen language. */
  readonly collator: Intl.Collator;
  /** Position names in the chosen language (positionNameIn). */
  readonly positionName: (code: number) => string;
  readonly wide: boolean;
  readonly dispatch: Dispatch<ScoutAction>;
}

/** The filtered and sorted list with its toolbar; the filter form opens from it on phones. */
const ListResults = ({
  state,
  players,
  collator,
  positionName,
  wide,
  form,
  columns,
  dispatch,
}: ListViewProps & { form: JSX.Element; columns: readonly SortKey[] }) => {
  const { visible, sort } = useVisiblePlayers(players, state, collator);
  const ratingCode = state.filters.positionRating?.code ?? null;
  const ratingName = ratingCode === null ? null : ratingAbbreviation(ratingCode, positionName);
  const List = wide ? PlayerTable : PlayerCards;
  return (
    <section className="results" aria-labelledby={RESULTS_TITLE_ID}>
      <h2 id={RESULTS_TITLE_ID} className="visually-hidden" tabIndex={-1}>
        {TEXT.showList}
      </h2>
      <div className="toolbar">
        {wide ? null : (
          <FiltersDialogButton count={activeFilters(state.filters).length}>
            {form}
          </FiltersDialogButton>
        )}
        <SortControls state={state} ratingName={ratingName} dispatch={dispatch} />
        <ResultCount count={visible.length} />
      </div>
      <FilterChips
        filters={state.filters}
        settings={state}
        players={players}
        positionName={positionName}
        folded={!wide}
        dispatch={dispatch}
      />
      {visible.length === 0 ? (
        <NoMatches dispatch={dispatch} />
      ) : (
        <List
          players={visible}
          allPlayers={players}
          sort={sort}
          columns={columns}
          ratingCode={ratingCode}
          ratingName={ratingName}
          currency={state.career?.currency ?? null}
          dispatch={dispatch}
        />
      )}
    </section>
  );
};

export const ListView = (props: ListViewProps): JSX.Element => {
  const { state, players, collator, positionName, wide, dispatch } = props;
  const columns = useColumns(state, players, wide);
  const form = (
    <>
      <FilterSets sets={state.filterSets ?? []} dispatch={dispatch} />
      <FilterForm
        players={players}
        collator={collator}
        positionName={positionName}
        filters={state.filters}
        myTeamId={state.myTeamId}
        showPotential={state.showPotential}
        settings={state}
        currency={state.career?.currency ?? null}
        columns={columns}
        dispatch={dispatch}
      />
    </>
  );
  return (
    <div className={wide ? "list-layout wide" : "list-layout"}>
      {wide ? (
        <aside className="filter-panel" aria-labelledby="filters-title">
          <h2 id="filters-title">{TEXT.filters}</h2>
          {form}
        </aside>
      ) : null}
      <ListResults {...props} form={form} columns={columns} />
    </div>
  );
};
