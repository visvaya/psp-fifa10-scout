// The own watchlist on the player card: a button to add or remove the player. His note is a section of
// its own (note-section.tsx) and stays when he leaves the list, so removing asks nothing.
import type { Dispatch, JSX } from "react";
import type { ScoutAction } from "../logic/scout-state.ts";
import { HelpHeading } from "./field-help.tsx";
import { HELP_TEXT } from "./text-help.ts";
import { WATCHLIST_TEXT } from "./text-watchlist.ts";

export const WatchlistSection = (props: {
  playerId: number;
  /** Whether the player is on the list. */
  watched: boolean;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { playerId, watched, dispatch } = props;
  return (
    <section className="watchlist" aria-labelledby="watchlist-title">
      <HelpHeading id="watchlist-title" title={WATCHLIST_TEXT.title} help={HELP_TEXT.watchlist} />
      <button
        type="button"
        className="button"
        onClick={() => {
          dispatch(
            watched
              ? { type: "watch-removed", id: playerId }
              : { type: "watch-added", id: playerId, addedAt: new Date().toISOString() },
          );
        }}
      >
        {watched ? WATCHLIST_TEXT.remove : WATCHLIST_TEXT.add}
      </button>
    </section>
  );
};
