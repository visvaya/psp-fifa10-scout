// The texts of the values after signing (roadmap 56): the filter panel's switch and the card's section,
// a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

export const SIGNING_TEXT = {
  label: pl`Wartość po podpisaniu`,
  help: pl`Zawodnicy spoza twojego składu z wartościami, jakie gra da im po podpisaniu: przy wejściu do twojego składu potencjał rośnie o szybkość nauki plus resztę z dzielenia potencjału przez 5 (razem od 1 do 9), więc OVR, szczyty i cena, które stały na potencjale, rosną razem z nim. Filtry, sortowanie, kolumny i karta liczą wtedy z tych wartości; formularz oferty dalej liczy dla zawodnika przed transferem. Pierwsze włączenie po wczytaniu plików liczy listę kilka sekund.`,
  pending: pl`Liczę wartości po podpisaniu…`,
  failed: pl`Nie udało się policzyć wartości po podpisaniu; lista pokazuje wartości sprzed podpisania.`,
  /** The card's section of what signing changes, and the words a screen reader hears for its arrow. */
  card: {
    title: "Po podpisaniu",
    before: "przed podpisaniem",
    arrow: " → ",
    after: "po podpisaniu",
  },
};
