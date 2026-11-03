import { useEffect, useReducer } from "react";
import type { JSX } from "react";
import { initialScoutState, scoutReducer } from "../logic/scout-state.ts";
import { ListView } from "./list-view.tsx";
import { PlayerCard } from "./player-card.tsx";
import { StartScreen } from "./start-screen.tsx";
import { TEXT } from "./text.ts";
import { UpdatePrompt } from "./update-prompt.tsx";
import { useMediaQuery } from "./use-media-query.ts";
import { useScoutFiles } from "./use-scout-files.ts";

/** Wide layout (table and side panel) from this width; matches --layout-wide in styles.css. */
const WIDE_QUERY = "(min-width: 60rem)";

export const App = (): JSX.Element => {
  const [state, dispatch] = useReducer(scoutReducer, initialScoutState);
  const files = useScoutFiles(dispatch);
  const wide = useMediaQuery(WIDE_QUERY);
  const { ready, savePreferences } = files;
  const { players, view, filters, sort } = state;

  useEffect(() => {
    // Only after the stored preferences were restored, so defaults never overwrite them.
    if (ready) savePreferences({ filters, sort });
  }, [ready, savePreferences, filters, sort]);

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
          <ListView state={state} players={players} wide={wide} dispatch={dispatch} />
        ) : (
          <StartScreen
            state={state}
            ready={ready}
            hasStoredGame={files.hasStoredGame}
            onGame={files.pickGame}
            onSave={files.pickSave}
          />
        )}
      </main>
      {openPlayer === undefined ? null : (
        <PlayerCard
          player={openPlayer}
          career={state.myTeamId !== null}
          onClose={() => {
            dispatch({ type: "player-closed" });
          }}
        />
      )}
    </div>
  );
};
