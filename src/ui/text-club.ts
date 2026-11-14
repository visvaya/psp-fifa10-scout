// The texts of the club dialog (roadmap 98): the formations ranked by their best eleven, a part of the
// UI texts beside text.ts.
import { formatRating } from "./text.ts";
import { pl } from "./typeset.ts";

const MINUS = "−";

export const CLUB_TEXT = {
  title: pl`Mój klub`,
  formations: pl`Najlepsza formacja`,
  formationsHelp: pl`Dla każdej formacji z bazy gry najlepsza jedenastka twojego składu: zawodnicy rozstawieni tak, by suma ich OVR na pozycjach formacji była największa (każdy na jednej pozycji). Formacje uszeregowane według średniego OVR tej jedenastki; różnica liczona do najlepszej jedenastki w formacji twojego klubu z zapisu, nie do składu ustawionego w grze. Nazwa formacji to liczba zawodników w kolejnych liniach od obrony (obrona, defensywna pomoc, pomoc, ofensywna pomoc, atak); gra nie nazywa formacji w bazie. Zawodnicy wypożyczeni z twojego klubu się nie liczą, kontuzjowani tak.`,
  valueLegend: "Licz według",
  values: { now: "OVR dziś", peak: "szczyt OVR" },
  table: pl`Formacje według średniego OVR najlepszej jedenastki`,
  formation: "Formacja",
  average: pl`Średnia`,
  difference: pl`Różnica do obecnej`,
  /** A formation's name with its mark when it is the club's. */
  name: (name: string, current: boolean): string => (current ? `${name} (obecna)` : name),
  eleven: (name: string): string => pl`Jedenastka: ${name}`,
  noPlayer: pl`brak zawodnika`,
  average1: (value: number): string => formatRating(value),
  /** A difference to the current formation with one decimal and its sign: +0,4 or −1,2. */
  difference1: (value: number): string =>
    value > 0.05
      ? `+${formatRating(value)}`
      : value < -0.05
        ? `${MINUS}${formatRating(-value)}`
        : formatRating(0),
};
