// The user's note on the player card, for any player. It saves with every change, so it has no save
// button, and it does not add the player to the own list.
import type { Dispatch, JSX } from "react";
import { SCOUT_CONFIG } from "../logic/config.ts";
import type { ScoutAction } from "../logic/scout-state.ts";
import { HelpHeading } from "./field-help.tsx";
import { HELP_TEXT } from "./text-help.ts";
import { NOTES_TEXT } from "./text-notes.ts";

export const NoteSection = (props: {
  playerId: number;
  playerName: string;
  /** The note's text, empty while the player has none. */
  text: string;
  dispatch: Dispatch<ScoutAction>;
}): JSX.Element => {
  const { playerId, playerName, text, dispatch } = props;
  return (
    <section className="note" aria-labelledby="note-title">
      <HelpHeading id="note-title" title={NOTES_TEXT.cardTitle} help={HELP_TEXT.note} />
      <label className="field">
        <span>{NOTES_TEXT.field}</span>
        <textarea
          rows={3}
          maxLength={SCOUT_CONFIG.noteMaxChars}
          value={text}
          onChange={(event) => {
            dispatch({
              type: "note-changed",
              id: playerId,
              text: event.currentTarget.value,
              name: playerName,
              changedAt: new Date().toISOString(),
            });
          }}
        />
      </label>
    </section>
  );
};
