// The own watchlist on the player card: a button to add or remove the player and, while he is on the
// list, his note. The note saves with every change, so it has no save button.
import { useId } from "react";
import type { Dispatch, JSX } from "react";
import { SCOUT_CONFIG } from "../logic/config.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { WatchEntry } from "../logic/watchlist.ts";
import { WATCHLIST_TEXT } from "./text-watchlist.ts";

export const WatchlistSection = (props: {
  playerId: number;
  /** The player's entry, undefined while he is not on the list. */
  entry: WatchEntry | undefined;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { playerId, entry, dispatch } = props;
  const helpId = useId();
  return (
    <section className="watchlist" aria-labelledby="watchlist-title">
      <h3 id="watchlist-title">{WATCHLIST_TEXT.title}</h3>
      <button
        type="button"
        className="button"
        onClick={() => {
          dispatch(
            entry === undefined
              ? { type: "watch-added", id: playerId, addedAt: new Date().toISOString() }
              : { type: "watch-removed", id: playerId },
          );
        }}
      >
        {entry === undefined ? WATCHLIST_TEXT.add : WATCHLIST_TEXT.remove}
      </button>
      {entry === undefined ? null : (
        <label className="field">
          <span>{WATCHLIST_TEXT.note}</span>
          <textarea
            rows={3}
            maxLength={SCOUT_CONFIG.watchlistNoteMaxChars}
            value={entry.note}
            aria-describedby={helpId}
            onChange={(event) => {
              dispatch({
                type: "watch-note-changed",
                id: playerId,
                note: event.currentTarget.value,
              });
            }}
          />
          <small id={helpId} className="help">
            {WATCHLIST_TEXT.noteHelp(SCOUT_CONFIG.watchlistNoteMaxChars)}
          </small>
        </label>
      )}
    </section>
  );
};
