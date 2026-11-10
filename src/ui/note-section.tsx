// The user's note on the player card, for any player. It saves with every change, so it has no save
// button, and it does not add the player to the own list. The section's heading names the field; its
// clear button asks first, since a cleared note is gone.
import { useEffect, useRef, useState } from "react";
import type { Dispatch, JSX, Ref } from "react";
import { SCOUT_CONFIG } from "../logic/config.ts";
import type { PlayerNote } from "../logic/player-notes.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { ConfirmQuestion } from "./confirm-question.tsx";
import { HelpHeading } from "./field-help.tsx";
import { TEXT } from "./text.ts";
import { HELP_TEXT } from "./text-help.ts";
import { NOTES_TEXT } from "./text-notes.ts";

/** The clear question's state: open, or how it was last answered. */
type Question = "asking" | "cleared" | "cancelled" | null;

/** The note's text, named by the section's heading, and when it last changed. */
const NoteField = ({
  note,
  onChange,
  ref,
}: {
  note: PlayerNote | undefined;
  onChange: (text: string) => void;
  ref: Ref<HTMLTextAreaElement>;
}): JSX.Element => (
  <div className="field">
    <textarea
      ref={ref}
      aria-labelledby="note-title"
      rows={3}
      maxLength={SCOUT_CONFIG.noteMaxChars}
      value={note?.text ?? ""}
      onChange={(event) => {
        onChange(event.currentTarget.value);
      }}
    />
    {note === undefined ? null : (
      <time className="note-date" dateTime={note.changedAt}>
        {NOTES_TEXT.changed(note.changedAt)}
      </time>
    )}
  </div>
);

export const NoteSection = (props: {
  playerId: number;
  playerName: string;
  /** The player's note, undefined while he has none. */
  note: PlayerNote | undefined;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { playerId, playerName, note, dispatch } = props;
  const [question, setQuestion] = useState<Question>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const clear = useRef<HTMLButtonElement>(null);
  // After the answer the keyboard goes back: to the emptied field, or to the button on "Anuluj".
  useEffect(() => {
    if (question === "cleared") field.current?.focus();
    if (question === "cancelled") clear.current?.focus();
  }, [question]);
  const changed = (value: string) => {
    dispatch({
      type: "note-changed",
      id: playerId,
      text: value,
      name: playerName,
      changedAt: new Date().toISOString(),
    });
  };
  return (
    <section className="note" aria-labelledby="note-title">
      <HelpHeading id="note-title" title={NOTES_TEXT.cardTitle} help={HELP_TEXT.note}>
        {note === undefined || question === "asking" ? null : (
          <button
            ref={clear}
            type="button"
            className="field-clear"
            aria-label={TEXT.clearFieldLabel(NOTES_TEXT.cardTitle)}
            onClick={() => {
              setQuestion("asking");
            }}
          >
            {TEXT.clearField}
          </button>
        )}
      </HelpHeading>
      {question === "asking" ? (
        <div className="note-remove">
          <ConfirmQuestion
            question={NOTES_TEXT.clearQuestion}
            confirmLabel={NOTES_TEXT.clear}
            onAnswer={(confirmed) => {
              if (confirmed) changed("");
              setQuestion(confirmed ? "cleared" : "cancelled");
            }}
          />
        </div>
      ) : null}
      <NoteField ref={field} note={note} onChange={changed} />
    </section>
  );
};
