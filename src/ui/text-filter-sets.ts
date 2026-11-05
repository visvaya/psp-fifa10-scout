// The texts of the named filter sets (filter-sets.tsx), a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const FILTER_SETS_TEXT = {
  title: "Zapisane zestawy",
  name: "Nazwa zestawu",
  save: "Zapisz bieżące filtry",
  overwrite: "Nadpisz zestaw",
  overwriteNote: pl`Zestaw o tej nazwie już jest: zapis zastąpi jego filtry i sortowanie.`,
  none: pl`Brak zapisanych zestawów. Zapis obejmuje filtry i sortowanie.`,
  load: "Wczytaj",
  rename: "Zmień nazwę",
  /** Replaces a saved set's filters and sort with the current ones, after a question. */
  overwriteSet: "Nadpisz",
  overwriteQuestion: (name: string): string =>
    `Zastąpić filtry i sortowanie zestawu „${name}” bieżącymi?`,
  remove: "Usuń",
  saveName: "Zapisz nazwę",
  cancel: "Anuluj",
  emptyName: "Wpisz nazwę zestawu.",
  takenName: pl`Zestaw o tej nazwie już jest. Wybierz inną nazwę.`,
  newName: (name: string): string => `Nowa nazwa zestawu „${name}”`,
  /** The set a list button acts on, for screen readers. */
  of: (name: string): string => ` zestaw „${name}”`,
} as const;
