// The texts of the app's updates and offline storage (update prompt and the top bar's check), a part of
// the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const UPDATE_TEXT = {
  waiting: pl`Dostępna jest nowa wersja. Wczytane dane gry, zapis kariery i filtry zostaną zachowane.`,
  installing: "Instalowanie nowej wersji…",
  outdated: pl`Nowa wersja została zainstalowana w innym oknie. Wczytane dane gry, zapis kariery i filtry zostaną zachowane.`,
  failed: "Nie udało się pobrać nowej wersji. Spróbuj później.",
  unregistered: pl`Nie udało się zapisać narzędzia do pracy bez internetu. Odśwież stronę, aby spróbować ponownie.`,
  checking: "Sprawdzanie aktualizacji…",
  downloading: "Pobieranie nowej wersji…",
  current: "Masz najnowszą wersję.",
  unreachable: pl`Brak połączenia z internetem, nie można sprawdzić aktualizacji.`,
  check: "Sprawdź aktualizacje",
  checkMark: "↻",
  dismiss: "Zamknij komunikat",
  dismissMark: "×",
  reload: "Odśwież",
};
