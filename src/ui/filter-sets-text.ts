// The texts of the named filter sets (filter-sets.tsx).
export const FILTER_SETS_TEXT = {
  title: "Zapisane zestawy",
  name: "Nazwa zestawu",
  save: "Zapisz bieżące filtry",
  overwrite: "Nadpisz zestaw",
  overwriteNote: "Zestaw o tej nazwie już jest: zapis zastąpi jego filtry i sortowanie.",
  none: "Brak zapisanych zestawów. Zapis obejmuje filtry i sortowanie.",
  load: "Wczytaj",
  rename: "Zmień nazwę",
  remove: "Usuń",
  saveName: "Zapisz nazwę",
  cancel: "Anuluj",
  emptyName: "Wpisz nazwę zestawu.",
  takenName: "Zestaw o tej nazwie już jest. Wybierz inną nazwę.",
  newName: (name: string): string => `Nowa nazwa zestawu „${name}”`,
  /** The set a list button acts on, for screen readers. */
  of: (name: string): string => ` zestaw „${name}”`,
} as const;
