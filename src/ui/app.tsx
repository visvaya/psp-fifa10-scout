import { useEffect, useMemo, useReducer } from "react";
import type { JSX } from "react";
import { collatorFor, localizePlayers } from "../logic/game-names.ts";
import { activeLanguage, initialScoutState, scoutReducer } from "../logic/scout-state.ts";
import type { ScoutState } from "../logic/scout-state.ts";
import { ListView } from "./list-view.tsx";
import { PlayerCard } from "./player-card.tsx";
import { StartScreen } from "./start-screen.tsx";
import { TEXT } from "./text.ts";
import { UpdatePrompt } from "./update-prompt.tsx";
import { useMediaQuery } from "./use-media-query.ts";
import { useScoutFiles } from "./use-scout-files.ts";

/** Wide layout (table and side panel) from this width; matches --layout-wide in styles.css. */
const WIDE_QUERY = "(min-width: 60rem)";

/** The players with the names of the active game language, and that language's text order. */
const useGameNames = (state: ScoutState) => {
  const language = activeLanguage(state, navigator.languages);
  const { languages } = state;
  const collator = useMemo(() => collatorFor(language), [language]);
  const players = useMemo(
    () =>
      state.players === null
        ? null
        : localizePlayers(
            state.players,
            language === null ? null : (languages[language] ?? null),
            collator,
          ),
    [state.players, language, languages, collator],
  );
  return { language, players, collator };
};

/** Stores the preferences and the languages read, once the stored ones were restored. */
const useStoredState = (state: ScoutState, files: ReturnType<typeof useScoutFiles>) => {
  const { ready, savePreferences, saveLanguages } = files;
  const { filters, sort, showPotential, gameLanguage, languages } = state;
  useEffect(() => {
    // Only after the stored preferences were restored, so defaults never overwrite them.
    if (ready) {
      savePreferences({
        filters,
        sort,
        showPotential,
        ...(gameLanguage === undefined ? {} : { gameLanguage }),
      });
    }
  }, [ready, savePreferences, filters, sort, showPotential, gameLanguage]);

  useEffect(() => {
    if (ready) saveLanguages(languages);
  }, [ready, saveLanguages, languages]);
};

export const App = (): JSX.Element => {
  const [state, dispatch] = useReducer(scoutReducer, initialScoutState);
  const files = useScoutFiles(dispatch);
  const wide = useMediaQuery(WIDE_QUERY);
  const { language, players, collator } = useGameNames(state);
  useStoredState(state, files);
  const { view, showPotential } = state;

  const openPlayer = players?.find((player) => player.id === state.openPlayerId);
  return (
    <div className="app">
      <header className="topbar">
        <h1>{TEXT.appTitle}</h1>
        {players === null ? null : (
          <button
            type="button"
            className="button"
            onClick={() => {
              dispatch({ type: "view-changed", view: view === "list" ? "start" : "list" });
            }}
          >
            {view === "list" ? TEXT.showFiles : TEXT.showList}
          </button>
        )}
      </header>
      <UpdatePrompt />
      <main className="main">
        {view === "list" && players !== null ? (
          <ListView
            state={state}
            players={players}
            collator={collator}
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
          />
        )}
      </main>
      {openPlayer === undefined ? null : (
        <PlayerCard
          player={openPlayer}
          career={state.myTeamId !== null}
          showPotential={showPotential}
          onClose={() => {
            dispatch({ type: "player-closed" });
          }}
        />
      )}
    </div>
  );
};
