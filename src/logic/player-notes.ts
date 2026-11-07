// The user's notes on players, one per player, apart from the own watchlist: a note neither adds a player
// to the list nor goes with him when he leaves it. Keyed by the player id that fifa.db and the saves share.
import { SCOUT_CONFIG } from "./config.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";

export interface PlayerNote {
  readonly playerId: number;
  /** Free text with something besides spaces, up to SCOUT_CONFIG.noteMaxChars characters. */
  readonly text: string;
  /** The player's name at the last change, for a database without him; null for a note moved from the list. */
  readonly name: string | null;
  /** The last change, as an ISO date and time. */
  readonly changedAt: string;
}

export const clippedNote = (text: string): string => text.slice(0, SCOUT_CONFIG.noteMaxChars);

/** The notes with one player's note replaced, cut to the limit; an empty one removes it. */
export const notedPlayer = (
  notes: readonly PlayerNote[],
  note: PlayerNote,
): readonly PlayerNote[] => {
  const others = notes.filter((item) => item.playerId !== note.playerId);
  if (note.text.trim() === "") return others;
  const changed = { ...note, text: clippedNote(note.text) };
  return notes.length === others.length
    ? [...notes, changed]
    : notes.map((item) => (item.playerId === note.playerId ? changed : item));
};

export const notesNewestFirst = (notes: readonly PlayerNote[]): readonly PlayerNote[] =>
  notes.toSorted((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt));

/** The first line of a note with text, trimmed. */
export const firstLine = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line !== "") ?? "";

export type NoteAction =
  | { readonly type: "notes-restored"; readonly notes: readonly PlayerNote[] }
  | {
      readonly type: "note-changed";
      readonly id: number;
      readonly text: string;
      readonly name: string;
      readonly changedAt: string;
    }
  /** From the notes view, for a player the loaded database lacks. */
  | { readonly type: "note-removed"; readonly id: number };

export const isNoteAction = (action: ScoutAction): action is NoteAction =>
  action.type.startsWith("note");

/** The notes after an action of the user. */
const notesAfter = (
  notes: readonly PlayerNote[],
  action: Exclude<NoteAction, { readonly type: "notes-restored" }>,
): readonly PlayerNote[] =>
  action.type === "note-removed"
    ? notes.filter((note) => note.playerId !== action.id)
    : notedPlayer(notes, {
        playerId: action.id,
        text: action.text,
        name: action.name,
        changedAt: action.changedAt,
      });

/** The state after an action of the notes; restoring the stored ones is no edit of them. */
export const notesReducer = (state: ScoutState, action: NoteAction): ScoutState =>
  action.type === "notes-restored"
    ? { ...state, notes: action.notes, notesEdited: false }
    : { ...state, notes: notesAfter(state.notes, action), notesEdited: true };
