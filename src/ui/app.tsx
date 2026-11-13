import { useEffect, useMemo, useReducer } from "react";
import type { Dispatch, JSX } from "react";
import {
  abbreviationIn,
  activeLanguage,
  collatorFor,
  localizePlayers,
  positionNameIn,
} from "../logic/game-names.ts";
import { shownCurrency } from "../logic/currency.ts";
import { inClub } from "../logic/filter-players.ts";
import type { OfferContext } from "../logic/offer.ts";
import type { Player } from "../logic/players.ts";
import { initialScoutState, scoutReducer } from "../logic/scout-state.ts";
import { needsSignedList, shownPlayers } from "../logic/signed-list.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { ListView } from "./list-view.tsx";
import { NotesButton } from "./notes-dialog.tsx";
import { WatchlistButton } from "./watchlist-dialog.tsx";
import { PlayerCard } from "./player-card.tsx";
import type { PositionNames } from "./position-name.tsx";
import { StartScreen } from "./start-screen.tsx";
import { TEXT } from "./text.ts";
import { canCheck, UPDATE_CHECK_ID, useAppUpdate } from "./app-update.ts";
import type { UpdatableRegistration } from "./app-update.ts";
import { UpdatePrompt } from "./update-prompt.tsx";
import { useMediaQuery } from "./use-media-query.ts";
import { useScoutFiles } from "./use-scout-files.ts";
import { GameImages } from "./game-image.tsx";

/** Wide layout (table and side panel) from this width; matches --layout-wide in styles.css. */
const WIDE_QUERY = "(min-width: 60rem)";

/** The players with the names of the active game language, its text order and its position names. */
const useGameNames = (state: ScoutState) => {
  const language = activeLanguage(state, navigator.languages);
  const names = language === null ? null : (state.languages[language] ?? null);
  // The collator only once there are players: it is costly to build (lazy.ts).
  const shown = shownPlayers(state);
  const list = useMemo(() => {
    if (shown === null) return null;
    const collator = collatorFor(language);
    return { players: localizePlayers(shown, names, collator), collator };
  }, [shown, names, language]);
  const positionNames = useMemo(
    (): PositionNames => ({
      short: (code) => positionNameIn(names, code),
      abbreviation: (code) => abbreviationIn(names, code),
      full: (code) => names?.positionNames[code],
    }),
    [names],
  );
  return { language, list, positionNames };
};

/** Stores the preferences, the languages read, the watchlist and the notes, once the stored ones were restored. */
const useStoredState = (state: ScoutState, files: ReturnType<typeof useScoutFiles>) => {
  const { ready, savePreferences, saveLanguages, saveWatchlist, saveNotes } = files;
  const {
    filters,
    sort,
    showPotential,
    gameLanguage,
    currency,
    filterSets,
    columns,
    tieOrder,
    afterSigning,
    approximatePortraits,
    languages,
    watchlist,
    watchlistEdited,
    notes,
    notesEdited,
  } = state;
  useEffect(() => {
    // Only after the stored preferences were restored, so defaults never overwrite them.
    if (ready) {
      savePreferences({
        filters,
        sort,
        showPotential,
        ...(gameLanguage === undefined ? {} : { gameLanguage }),
        ...(currency === undefined ? {} : { currency }),
        ...(filterSets === undefined ? {} : { filterSets }),
        ...(columns === undefined ? {} : { columns }),
        ...(tieOrder === undefined ? {} : { tieOrder }),
        ...(afterSigning === undefined ? {} : { afterSigning }),
        ...(approximatePortraits === undefined ? {} : { approximatePortraits }),
      });
    }
  }, [
    ready,
    savePreferences,
    filters,
    sort,
    showPotential,
    gameLanguage,
    currency,
    filterSets,
    columns,
    tieOrder,
    afterSigning,
    approximatePortraits,
  ]);

  useEffect(() => {
    if (ready) saveLanguages(languages);
  }, [ready, saveLanguages, languages]);

  useEffect(() => {
    // Only a list the user changed: one the store holds but the app cannot read stays as it is.
    if (ready && watchlistEdited) saveWatchlist(watchlist);
  }, [ready, saveWatchlist, watchlist, watchlistEdited]);

  useEffect(() => {
    if (ready && notesEdited) saveNotes(notes);
  }, [ready, saveNotes, notes, notesEdited]);
};

/**
 * The title, a check for a new version once a worker is registered, and once there are players the
 * notes (on a phone they sit by the filters, list-view.tsx) and a switch between the list and the files.
 */
const TopBar = (props: {
  state: ScoutState;
  /** The players once loaded. */
  list: { readonly players: readonly Player[] } | null;
  wide: boolean;
  update: ReturnType<typeof useAppUpdate>;
  dispatch: Dispatch<ScoutAction>;
}) => {
  const { state, list, wide, update, dispatch } = props;
  return (
    <header className="topbar">
      <h1>{TEXT.appTitle}</h1>
      {update.registered ? (
        <button
          type="button"
          className="button"
          id={UPDATE_CHECK_ID}
          aria-label={TEXT.update.check}
          title={TEXT.update.check}
          disabled={!canCheck(update.status)}
          onClick={update.check}
        >
          <span aria-hidden="true">{TEXT.update.checkMark}</span>
        </button>
      ) : null}
      {list === null || !wide ? null : (
        <>
          <NotesButton notes={state.notes} players={list.players} dispatch={dispatch} />
          <WatchlistButton
            watchlist={state.watchlist}
            players={list.players}
            career={state.myTeamId !== null}
            dispatch={dispatch}
          />
        </>
      )}
      {list === null ? null : (
        <button
          type="button"
          className="button"
          onClick={() => {
            dispatch({ type: "view-changed", view: state.view === "list" ? "start" : "list" });
          }}
        >
          {state.view === "list" ? TEXT.showFiles : TEXT.showList}
        </button>
      )}
    </header>
  );
};

/** A region that is always there, so a screen reader hears the notice when it appears. */
const StorageNotice = ({ failed }: { failed: boolean }) => (
  <output className="storage-notice">{failed ? <p>{TEXT.storageFailed}</p> : null}</output>
);

/** The user's side of an offer for a player: none without a career and for his own players. */
const offerFor = ({ myTeamId, career }: ScoutState, player: Player): OfferContext | null =>
  myTeamId !== null && inClub(player, myTeamId) ? null : (career?.offer ?? null);

/** The player as an offer counts him: before the transfer, whatever values the list shows. */
const beforeSigning = ({ players }: ScoutState, player: Player): Player =>
  players?.find((candidate) => candidate.id === player.id) ?? player;

/** Asks the worker for the list after signing once the setting wants it and nothing asked yet. */
const useSignedList = (state: ScoutState, requestSigned: () => void) => {
  const wanted = needsSignedList(state);
  useEffect(() => {
    if (wanted) requestSigned();
  }, [wanted, requestSigned]);
};

/** The card of the open player, if he is listed. */
const OpenCard = (props: {
  state: ScoutState;
  players: readonly Player[] | undefined;
  names: PositionNames;
  dispatch: Dispatch<ScoutAction>;
}) => {
  const { state, names, dispatch } = props;
  const openPlayer = props.players?.find((player) => player.id === state.openPlayerId);
  return openPlayer === undefined ? null : (
    <PlayerCard
      player={openPlayer}
      names={names}
      career={state.myTeamId !== null}
      currency={shownCurrency(state)}
      curves={state.curves}
      offer={offerFor(state, openPlayer)}
      offerPlayer={beforeSigning(state, openPlayer)}
      showPotential={state.showPotential}
      watched={state.watchlist.some((entry) => entry.playerId === openPlayer.id)}
      note={state.notes.find((note) => note.playerId === openPlayer.id)}
      dispatch={dispatch}
      onClose={() => {
        dispatch({ type: "player-closed" });
      }}
    />
  );
};

/** registering: the service worker's registration, null where none is made (main.tsx). */
export const App = (props: { registering: Promise<UpdatableRegistration> | null }): JSX.Element => {
  const [state, dispatch] = useReducer(scoutReducer, initialScoutState);
  const files = useScoutFiles(dispatch);
  const wide = useMediaQuery(WIDE_QUERY);
  const { language, list, positionNames } = useGameNames(state);
  const update = useAppUpdate(props.registering);
  useStoredState(state, files);
  useSignedList(state, files.requestSigned);

  return (
    <GameImages pack={state.graphics} approximate={state.approximatePortraits === true}>
      <div className="app">
        <TopBar state={state} list={list} wide={wide} update={update} dispatch={dispatch} />
        <UpdatePrompt status={update.status} install={update.install} dismiss={update.dismiss} />
        <StorageNotice failed={files.storageFailed} />
        <main className="main">
          {state.view === "list" && list !== null ? (
            <ListView
              state={state}
              players={list.players}
              collator={list.collator}
              positionName={positionNames.short}
              wide={wide}
              dispatch={dispatch}
            />
          ) : (
            <StartScreen
              state={state}
              ready={files.ready}
              language={language}
              onGame={files.pickGame}
              onSave={files.pickSave}
              onForgetSave={files.forgetSave}
              onLocale={files.pickLocale}
              dispatch={dispatch}
              offline={!update.unregistered}
            />
          )}
        </main>
        <OpenCard state={state} players={list?.players} names={positionNames} dispatch={dispatch} />
      </div>
    </GameImages>
  );
};
