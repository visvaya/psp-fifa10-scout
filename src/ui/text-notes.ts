// The texts of the notes on players: the note on the card (note-section.tsx) and the list of all notes
// (notes-dialog.tsx), a part of the UI texts beside text.ts.
import { lazy } from "../logic/lazy.ts";
import { pl } from "./typeset.ts";

const changeFormat = lazy(() => new Intl.DateTimeFormat("pl", { dateStyle: "medium" }));

export const NOTES_TEXT = {
  /** The top bar's button and the list's title. */
  title: "Notatki",
  cardTitle: "Twoja notatka",
  /** Says by its name that a note is not the list. */
  field: pl`Notatka (nie dodaje do listy)`,
  empty: pl`Nie masz jeszcze notatek. Notatkę dodasz na karcie zawodnika.`,
  /** A player the loaded database lacks, stored without a name. */
  unknownPlayer: (id: number): string => pl`Zawodnik nr ${id}`,
  remove: "Usuń",
  /** The remove button's name: the visible "Usuń" and whose note it removes. */
  removeLabel: (name: string): string => `Usuń notatkę: ${name}`,
  removeQuestion: (name: string): string => `Usunąć notatkę: ${name}?`,
  /** The date of the last change of a note. */
  changed: (iso: string): string => `zmieniona ${changeFormat().format(new Date(iso))}`,
} as const;
