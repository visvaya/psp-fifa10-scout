// The own watchlist on the player card: a button to add or remove the player and, while he is on the
// list, his note. The note saves with every change, so it has no save button. Removing a player who has
// a note asks first, as "Resetuj" does (settings-actions.tsx).
import { useEffect, useRef, useState } from "react";
import type { Dispatch, JSX } from "react";
import { SCOUT_CONFIG } from "../logic/config.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import type { WatchEntry } from "../logic/watchlist.ts";
import { ConfirmQuestion } from "./confirm-question.tsx";
import { HelpHeading } from "./field-help.tsx";
import { HELP_TEXT } from "./text-help.ts";
import { WATCHLIST_TEXT } from "./text-watchlist.ts";

/** The note field, named by its label alone. */
const NoteField = (props: { note: string; onChange: (note: string) => void }): JSX.Element => (
  <label className="field">
    <span>{WATCHLIST_TEXT.note}</span>
    <textarea
      rows={3}
      maxLength={SCOUT_CONFIG.watchlistNoteMaxChars}
      value={props.note}
      onChange={(event) => {
        props.onChange(event.currentTarget.value);
      }}
    />
  </label>
);

const LIST_HELP = HELP_TEXT.watchlist(SCOUT_CONFIG.watchlistNoteMaxChars);

export const WatchlistSection = (props: {
  playerId: number;
  /** The player's entry, undefined while he is not on the list. */
  entry: WatchEntry | undefined;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { playerId, entry, dispatch } = props;
  const [asking, setAsking] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  // After an answer the focus goes back to the toggle button, which comes back with the answer.
  const answered = useRef(false);
  useEffect(() => {
    if (!asking && answered.current) toggle.current?.focus();
    answered.current = false;
  }, [asking]);
  return (
    <section className="watchlist" aria-labelledby="watchlist-title">
      <HelpHeading id="watchlist-title" title={WATCHLIST_TEXT.title} help={LIST_HELP} />
      {asking ? (
        <div className="watchlist-answer">
          <ConfirmQuestion
            question={WATCHLIST_TEXT.removeQuestion}
            confirmLabel={WATCHLIST_TEXT.remove}
            onAnswer={(remove) => {
              if (remove) dispatch({ type: "watch-removed", id: playerId });
              answered.current = true;
              setAsking(false);
            }}
          />
        </div>
      ) : (
        <button
          ref={toggle}
          type="button"
          className="button"
          onClick={() => {
            if (entry === undefined) {
              dispatch({ type: "watch-added", id: playerId, addedAt: new Date().toISOString() });
            } else if (entry.note.trim() === "") {
              dispatch({ type: "watch-removed", id: playerId });
            } else {
              setAsking(true);
            }
          }}
        >
          {entry === undefined ? WATCHLIST_TEXT.add : WATCHLIST_TEXT.remove}
        </button>
      )}
      {entry === undefined ? null : (
        <NoteField
          note={entry.note}
          onChange={(note) => {
            dispatch({ type: "watch-note-changed", id: playerId, note });
          }}
        />
      )}
    </section>
  );
};
