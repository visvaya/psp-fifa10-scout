// All the user's notes on players, newest change first, opened from the top bar. A player of the loaded
// database opens his card over the list; one the database lacks shows his stored name or id.
import { useMemo } from "react";
import type { Dispatch, JSX } from "react";
import { firstLine, notesNewestFirst } from "../logic/player-notes.ts";
import type { PlayerNote } from "../logic/player-notes.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { DialogButton } from "./modal-dialog.tsx";
import { NOTES_TEXT } from "./text-notes.ts";

const NotesList = (props: {
  notes: readonly PlayerNote[];
  players: readonly Player[];
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { notes, players, dispatch } = props;
  const names = useMemo(
    () => new Map(players.map((player) => [player.id, player.name] as const)),
    [players],
  );
  if (notes.length === 0) return <p>{NOTES_TEXT.empty}</p>;
  return (
    <ul className="notes-list">
      {notesNewestFirst(notes).map((note) => {
        const name = names.get(note.playerId);
        return (
          <li key={note.playerId}>
            {name === undefined ? (
              <strong>{note.name ?? NOTES_TEXT.unknownPlayer(note.playerId)}</strong>
            ) : (
              <button
                type="button"
                className="link-button"
                // Where the card returns focus (player-card.tsx): this dialog comes before the list's rows.
                data-player-id={note.playerId}
                onClick={() => {
                  dispatch({ type: "player-opened", id: note.playerId });
                }}
              >
                {name}
              </button>
            )}
            <span className="note-line">{firstLine(note.text)}</span>
            <time className="note-date" dateTime={note.changedAt}>
              {NOTES_TEXT.changed(note.changedAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
};

export const NotesButton = (props: {
  notes: readonly PlayerNote[];
  players: readonly Player[];
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => (
  <DialogButton
    label={NOTES_TEXT.title}
    title={NOTES_TEXT.title}
    className="notes"
    buttonClassName="button"
  >
    <NotesList {...props} />
  </DialogButton>
);
