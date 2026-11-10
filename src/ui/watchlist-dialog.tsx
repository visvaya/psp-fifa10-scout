// The wish lists, opened from the top bar beside the notes: the own list in the tool and, with a career
// save, the game's shortlist, one at a time. A player of the loaded database opens his card over the
// list; one the database lacks shows his id.
import { useState } from "react";
import type { Dispatch, JSX } from "react";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { listedPlayers } from "../logic/watchlist.ts";
import type { WatchEntry } from "../logic/watchlist.ts";
import { RadioField } from "./filter-form.tsx";
import { BarDialogButton } from "./modal-dialog.tsx";
import { LIST_MEMBERSHIP_LABELS } from "./text-choices.ts";
import { NOTES_TEXT } from "./text-notes.ts";
import { WATCHLIST_TEXT } from "./text-watchlist.ts";

const LISTS = ["tool", "game"] as const;

const WatchlistView = (props: {
  watchlist: readonly WatchEntry[];
  players: readonly Player[];
  career: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { watchlist, players, career, dispatch } = props;
  const [which, setWhich] = useState<(typeof LISTS)[number]>("tool");
  const listed = listedPlayers(career ? which : "tool", watchlist, players);
  return (
    <>
      {career ? (
        <RadioField
          legend={WATCHLIST_TEXT.switchLegend}
          name="watchlist-shown"
          options={LISTS}
          labels={LIST_MEMBERSHIP_LABELS}
          value={which}
          onChange={setWhich}
        />
      ) : null}
      {listed.length === 0 ? (
        <p>{which === "game" && career ? WATCHLIST_TEXT.emptyGame : WATCHLIST_TEXT.emptyTool}</p>
      ) : (
        <ul className="notes-list">
          {listed.map(({ id, player }) => (
            <li key={id}>
              {player === undefined ? (
                <strong>{NOTES_TEXT.unknownPlayer(id)}</strong>
              ) : (
                <>
                  <button
                    type="button"
                    className="link-button"
                    // Where the card returns focus (player-card.tsx): this dialog comes before the list's rows.
                    data-player-id={id}
                    onClick={() => {
                      dispatch({ type: "player-opened", id });
                    }}
                  >
                    {player.name}
                  </button>
                  <span className="note-line">
                    {WATCHLIST_TEXT.line(player.positionName, player.overall)}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export const WatchlistButton = (props: {
  watchlist: readonly WatchEntry[];
  players: readonly Player[];
  /** A career save is loaded, so the game's shortlist is known. */
  career: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => (
  <BarDialogButton title={WATCHLIST_TEXT.dialogTitle}>
    <WatchlistView {...props} />
  </BarDialogButton>
);
