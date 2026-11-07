// Explanations behind the "?" beside a field's name (field-help.tsx), in the filters and on the player card;
// a part of the UI texts beside text.ts. Each states what the tool shows and what the game's code and saves
// confirmed (docs: game-knowledge and the specs in the notes).
import type { FlagKey, ListKey, RangeKey } from "../logic/filter-players.ts";
import { pl } from "./typeset.ts";

const LEAGUE_STATS = pl`Liczby z zapisu kariery za bieżący sezon, z meczów ligi twojego klubu; gra zeruje je na początku sezonu. U zawodnika, który odszedł z twojej ligi, to liczby z czasu gry w niej.`;
const CUP_STATS = pl`Liczby z zapisu kariery za bieżący sezon, z pucharów krajowych i europejskich razem; gra zeruje je na początku sezonu. Które puchary liczy, zależy od ligi twojego klubu, np. dla Ekstraklasy Puchar Polski, „Klubowe ME” i „Puchar EFA”.`;

export const FIELD_HELP: Partial<Readonly<Record<RangeKey | ListKey | FlagKey, string>>> = {
  positionGroup: pl`Pozycje zgrupowane według sposobu liczenia OVR w grze: w jednej grupie te same wagi atrybutów.`,
  weakFoot: pl`Gwiazdki z bazy gry, od 1 do 5: jak dobrze zawodnik gra słabszą nogą.`,
  age: pl`Wiek w dniu ostatniego meczu z zapisu kariery; bez zapisu 1 lipca 2009.`,
  overall: pl`OVR na pozycji preferowanej, liczony wzorem gry z atrybutów. Z zapisem kariery na wiek z pierwszej kolejki sezonu i z przyrostami atrybutów zapisanymi w karierze, tak jak liczy go gra; bez zapisu prosto z bazy gry.`,
  potential: pl`Limit rozwoju z bazy gry; gra tej liczby nie pokazuje. Gdy zawodnik trafia do twojego składu, gra podnosi go o 1 do 9 (szybkość nauki i reszta z dzielenia potencjału przez 5); u zawodników twojego składu narzędzie liczy z tą poprawką z zapisu.`,
  growth: pl`Potencjał minus OVR: ile brakuje do limitu potencjału (w karierze z poprawką z zapisu). Zawodnicy rzadko go osiągają; realniejszy jest szczyt OVR.`,
  peak: pl`OVR na szczycie rozwoju według krzywych gry, na pozycji preferowanej zawodnika albo, gdy zaznaczone jest pole poniżej, na jego najlepszej pozycji. Na pozycji preferowanej ten sam co na wykresie rozwoju w grze. Bez przyszłych przyrostów z meczów i treningu.`,
  peakGain: pl`Szczyt OVR minus OVR: ile zawodnik jeszcze urośnie według krzywych rozwoju gry. W filtrze z zaznaczonym polem przy szczycie OVR to szczyt na najlepszej pozycji minus dzisiejszy OVR na tej pozycji.`,
  onMyList: pl`Twoja lista z tego narzędzia, zapisana w tej przeglądarce; gra o niej nie wie. Lista życzeń z gry to osobne pole w sekcji Kariera.`,
  bodyType: pl`Gra nie nazywa kodów. Przy podobnym wzroście typ 1 to średnio zawodnicy najlżejsi, typ 3 najciężsi.`,
  internationalReputation: pl`Gwiazdki z bazy gry, od 1 do 5. Według wzorów gry 4 i 5 gwiazdek podnoszą cenę i zarobki rynkowe; 1–3 gwiazdki ich nie zmieniają.`,
  learningSpeed: pl`Wartość z bazy gry. Gdy zawodnik trafia do twojego składu, gra dodaje ją do jego potencjału, razem z resztą z dzielenia potencjału przez 5.`,
  retirementAge: pl`Wiek z bazy gry. Zawodnik nie podpisze kontraktu, który sięgałby poza ten wiek (licząc jego wiek na koniec sezonu), a długość kontraktu, której chce, gra skraca do tej granicy.`,
  developmentType: pl`Kiedy zawodnik osiąga szczyt według krzywych rozwoju gry: wcześnie, w typowym wieku albo późno.`,
  developmentStyle: pl`Kształt krzywej rozwoju umiejętności: jak wysoko i jak długo rośnie. Krótka kariera szybko spada po szczycie, nagły skok rośnie gwałtownie w kilka sezonów.`,
  clubRating: pl`Ocena drużyny od 1 do 99 zapisana w danych gry. Gwiazdek klubu gra z niej nie liczy: wylicza je z OVR 16 najlepszych zawodników kadry.`,
  nationalTeam: pl`Zawodnik kadry reprezentacji w bazie gry. Kariera tych kadr nie zmienia; na zgrupowania gra powołuje zawodników osobno, przed każdym oknem reprezentacyjnym.`,
  form: pl`KR z zapisu kariery, jak na ekranie statystyk zawodnika w grze: ocena krocząca ze wszystkich meczów, ligi i pucharów razem. Po każdym meczu z minutami to 80% poprzedniej wartości i 20% oceny z tego meczu. Zawodnik bez wcześniejszych meczów ma wartość startową 5,0. Na początku sezonu gra jej nie zeruje, więc zawodnik z meczami w poprzednim sezonie, a bez występów w obecnym, ma wartość z poprzedniego sezonu lub klubu.`,
  morale: pl`Wartość z zapisu kariery. Skala i wpływ morale na mecze nie są potwierdzone.`,
  appearances: pl`${LEAGUE_STATS} Wejście z ławki to też występ.`,
  goals: LEAGUE_STATS,
  assists: LEAGUE_STATS,
  cleanSheets: LEAGUE_STATS,
  cupAppearances: pl`${CUP_STATS} Wejście z ławki to też występ.`,
  cupGoals: CUP_STATS,
  cupAssists: CUP_STATS,
  cupCleanSheets: CUP_STATS,
  injuryDays: pl`Dni przerwy z powodu kontuzji według zapisu kariery; 0 to brak kontuzji.`,
  price: pl`Wartość według wzoru gry, jak CENA na liście rynku transferowego. Zależy m.in. od OVR, wieku, lat do końca kontraktu, reputacji i pozycji. Przy wygasłym kontrakcie i u wolnego zawodnika 0.`,
  wage: pl`Zarobki na mecz według wzoru gry, jak „Zarobki rynkowe” w formularzu oferty. Przy wygasłym kontrakcie (też w tym roku) z doliczonymi 30% (wolny transfer). Wzór nie odtwarza każdej pensji zapisanej w kontraktach, stąd szacunek. U zawodników twojego klubu zarobki z kontraktu zapisanego w karierze.`,
  transferListed: pl`Wystawiony na sprzedaż w oknie transferowym według zapisu kariery i jeszcze niesprzedany. W zapisach spoza okna transferowego ta lista była pusta.`,
  loanListed: pl`Wystawiony do wypożyczenia w oknie transferowym według zapisu kariery i jeszcze niewypożyczony.`,
  clubWillSell: pl`Reguły z kodu gry: klub odrzuca każdą ofertę, gdy ma 19 lub mniej zawodników, za mało zawodników w grupie pozycji tego zawodnika albo gdy jest odwiecznym rywalem twojego klubu. „Tak” znaczy, że żadna z tych reguł nie blokuje oferty; jej warunki pokazuje karta zawodnika. Osobno gra odrzuca każdą ofertę, gdy twoja kadra ma 30 lub więcej zawodników. Pole nie dotyczy twoich zawodników ani wolnych zawodników.`,
};

/** Explanations of fields outside the keyed filters. */
export const HELP_TEXT = {
  /** The "?" button's name. */
  label: (field: string): string => `Wyjaśnienie: ${field}`,
  mark: "?",
  positionRating: pl`OVR zawodnika na wybranej pozycji, liczony wagami atrybutów, których gra używa dla tej pozycji. Pozycje o tych samych wagach są jednym wyborem.`,
  ratingGain: pl`OVR na wybranej pozycji minus OVR na pozycji preferowanej. Dodatnia różnica: na tej pozycji zawodnik ma lepszą ocenę.`,
  bestPositionOnly: pl`Zostają tylko zawodnicy, którym wybrana pozycja daje największy OVR ze wszystkich pozycji; równy OVR na innej pozycji też się liczy.`,
  /** The peak at the position chosen in "Ocena na pozycji". */
  ratingPeak: pl`Szczyt OVR na tej pozycji według krzywych rozwoju gry, liczony jak szczyt OVR.`,
  /** The choice to count the peak at the best position, and the best peak on the card. */
  peakAtBest: pl`Szczyt liczy się osobno dla każdej pozycji; szczyt na najlepszej pozycji to największy z nich, a pozycja najlepsza dziś nie musi być najlepsza w szczycie. Zawodnik z OVR 72 jako napastnik i 68 jako prawy pomocnik może osiągnąć szczyt 82 jako napastnik i 83 jako prawy pomocnik; kolumna i filtr szczytu pokażą wtedy 83 i prawego pomocnika.`,
  clubStatus: pl`Wolny zawodnik nie ma klubu. Jego wartość (cena) to 0, a zarobki rynkowe gra liczy mu z doliczonymi 30%.`,
} as const;
