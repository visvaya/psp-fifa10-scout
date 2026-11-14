// The dialogs opened from the top bar on a wide screen, and beside the filters on a phone: the notes,
// the wish lists and, with a career, the club.
import type { Dispatch, JSX } from "react";
import type { Player } from "../logic/players.ts";
import type { ScoutAction, ScoutState } from "../logic/scout-state.ts";
import { ClubButton } from "./club-dialog.tsx";
import { NotesButton } from "./notes-dialog.tsx";
import { WatchlistButton } from "./watchlist-dialog.tsx";

export const BarDialogs = (props: {
  state: ScoutState;
  players: readonly Player[];
  /** Position abbreviations in the chosen language. */
  positionName: (code: number) => string;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { state, players, dispatch } = props;
  const { myTeamId, career } = state;
  return (
    <>
      <NotesButton notes={state.notes} players={players} dispatch={dispatch} />
      <WatchlistButton
        watchlist={state.watchlist}
        players={players}
        career={myTeamId !== null}
        dispatch={dispatch}
      />
      {myTeamId === null || career === null ? null : (
        <ClubButton
          players={players}
          myTeamId={myTeamId}
          career={career}
          showPotential={state.showPotential}
          positionName={props.positionName}
          dispatch={dispatch}
        />
      )}
    </>
  );
};
