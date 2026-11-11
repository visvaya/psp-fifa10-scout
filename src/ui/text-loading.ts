// The texts of loading the files: what is being read and why a file was refused, a part of the UI texts
// beside text.ts.
import type { LoadErrorKind, LoadPhase, LoadStage } from "../logic/load-scout.ts";
import type { ScoutError } from "../logic/scout-state.ts";
import { pl } from "./typeset.ts";

const PHASES: Readonly<Record<LoadPhase, string>> = {
  game: "Czytam plik gry…",
  save: "Czytam zapis…",
  players: "Przygotowuję listę…",
};

const ERRORS: Readonly<Record<LoadErrorKind | "missing-file", string>> = {
  "wrong-game": pl`To plik innej gry. Narzędzie obsługuje FIFA 10 na PSP (ULES01328).`,
  "wrong-file": "To nie jest właściwy plik. Sprawdź, czy wybrano dobry plik.",
  "not-career": pl`To zapis profilu albo składów, nie kariery. Wybierz pliki z folderu kariery, zwykle ULES01328081.`,
  damaged: "Plik jest uszkodzony albo niepełny. Skopiuj go jeszcze raz.",
  unexpected: "Nie udało się odczytać pliku. Spróbuj ponownie.",
  "missing-file": pl`Wybierz oba pliki naraz: DATA.BIN i PARAM.SFO.`,
};

const STAGES: Readonly<Record<LoadStage, string>> = {
  game: "Plik gry",
  save: "Zapis kariery",
  locale: "Plik języka",
};

const LOCALE_MISSING = pl`Wybierz oba pliki naraz: plik .loc i string.idx z tego samego folderu.`;

export const LOAD_TEXT = {
  phase: (phase: LoadPhase): string => PHASES[phase],
  error: (error: ScoutError): string =>
    `${STAGES[error.stage]}: ${
      error.stage === "locale" && error.kind === "missing-file"
        ? LOCALE_MISSING
        : ERRORS[error.kind]
    }`,
} as const;
