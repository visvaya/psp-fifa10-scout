// The texts of the profile after a transfer (roadmap 56): the filter panel's switch with its contract
// length and the card's section, a part of the UI texts beside text.ts.
import { pl } from "./typeset.ts";

/** The field of the profile after a transfer that joins text.ts's labels. */
export const SIGNING_LABELS = { transferWage: pl`Pensja po transferze` };

export const SIGNING_HELP = {
  transferWage: pl`Z zapisem kariery i polem „Profil po transferze”, u zawodników spoza twojego składu: najniższa pensja na mecz, za którą podpisze kontrakt z twoim klubem przy długości kontraktu, której chce, albo przy długości wybranej pod polem; liczona jak w formularzu oferty (pojedyncza oferta, bez premii). To jego koszt po podpisaniu, w odróżnieniu od zarobków rynkowych.`,
};

export const SIGNING_TEXT = {
  label: pl`Profil po transferze`,
  help: pl`Zawodnicy spoza twojego składu tacy, jacy będą po transferze do twojego klubu. Przy wejściu do twojego składu gra podnosi potencjał o szybkość nauki plus resztę z dzielenia potencjału przez 5 (razem od 1 do 9), więc OVR i szczyty, które stały na potencjale, rosną razem z nim. Cena to wartość w twoim klubie (prestiż twojego klubu i ligi, nowy kontrakt) przy długości kontraktu, której chce zawodnik, albo przy długości wybranej pod tym polem. Zarobki to zarobki rynkowe w twoim klubie; długość kontraktu ich nie zmienia. Filtry, sortowanie, kolumny i karta liczą wtedy z tych wartości. Warunki oferty na karcie zostają sprzed transferu, bo gra liczy je dla zawodnika w jego obecnym klubie. Zawodnicy twojego składu i wypożyczeni zostają bez zmian. Pierwsze włączenie po wczytaniu plików liczy listę kilka sekund.`,
  pending: pl`Liczę profil po transferze…`,
  failed: pl`Nie udało się policzyć profilu po transferze; lista pokazuje wartości sprzed transferu.`,
  /** The contract length his price after the transfer is for; the empty option is the one he wants. */
  years: pl`Długość kontraktu po transferze`,
  wantedYears: pl`jak chce zawodnik`,
  /** The card's section of what the transfer changes, and the words a screen reader hears for its arrow. */
  card: {
    title: "Po transferze",
    before: "przed transferem",
    arrow: " → ",
    after: "po transferze",
    priceRange: pl`Cena (kontrakt 1–5 lat)`,
  },
};
