// All the user's notes on players, newest change first, opened from the top bar. A player of the loaded
// database opens his card over the list; one the database lacks shows his stored name or id, and his
// note can be removed here, after a question, since no card of his opens.
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, JSX } from "react";
import { firstLine, notesNewestFirst } from "../logic/player-notes.ts";
import type { PlayerNote } from "../logic/player-notes.ts";
import type { Player } from "../logic/players.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { ConfirmQuestion } from "./confirm-question.tsx";
import { DialogButton } from "./modal-dialog.tsx";
import { NOTES_TEXT } from "./text-notes.ts";

/** A player the database lacks: his name and a button that removes his note after a question. */
const MissingPlayer = (props: { name: string; onRemove: () => void }): JSX.Element => {
  const { name, onRemove } = props;
  const [asking, setAsking] = useState(false);
  const remove = useRef<HTMLButtonElement>(null);
  // "Anuluj" gives the focus back to the remove button, which comes back with the answer.
  const cancelled = useRef(false);
  useEffect(() => {
    if (!asking && cancelled.current) remove.current?.focus();
    cancelled.current = false;
  }, [asking]);
  return (
    <>
      <strong>{name}</strong>
      {asking ? (
        <div className="note-remove">
          <ConfirmQuestion
            question={NOTES_TEXT.removeQuestion(name)}
            confirmLabel={NOTES_TEXT.remove}
            onAnswer={(confirmed) => {
              if (confirmed) {
                onRemove();
              } else {
                cancelled.current = true;
                setAsking(false);
              }
            }}
          />
        </div>
      ) : (
        <button
          ref={remove}
          type="button"
          className="button"
          aria-label={NOTES_TEXT.removeLabel(name)}
          onClick={() => {
            setAsking(true);
          }}
        >
          {NOTES_TEXT.remove}
        </button>
      )}
    </>
  );
};

/**
 * After a note is removed, the focus goes to the control of the note that took its place, else of the
 * one before it, else to the empty view.
 */
const useFocusAfterRemoval = () => {
  const list = useRef<HTMLUListElement>(null);
  const empty = useRef<HTMLParagraphElement>(null);
  const removedAt = useRef<number | null>(null);
  // After every render: the removal has rendered once the notes changed.
  useEffect(() => {
    const index = removedAt.current;
    if (index === null) return;
    removedAt.current = null;
    const items = list.current?.children ?? [];
    const item = items[index] ?? items[index - 1];
    (item?.querySelector("button") ?? empty.current)?.focus();
  });
  return { list, empty, removedAt };
};

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
  const { list, empty, removedAt } = useFocusAfterRemoval();
  if (notes.length === 0)
    return (
      <p ref={empty} tabIndex={-1}>
        {NOTES_TEXT.empty}
      </p>
    );
  return (
    <ul ref={list} className="notes-list">
      {notesNewestFirst(notes).map((note, index) => {
        const name = names.get(note.playerId);
        return (
          <li key={note.playerId}>
            {name === undefined ? (
              <MissingPlayer
                name={note.name ?? NOTES_TEXT.unknownPlayer(note.playerId)}
                onRemove={() => {
                  removedAt.current = index;
                  dispatch({ type: "note-removed", id: note.playerId });
                }}
              />
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
