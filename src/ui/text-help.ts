// Explanations behind the "?" beside a field's name (field-help.tsx), in the filters and on the player card;
// a part of the UI texts beside text.ts. Each states what the tool shows and what the game's code and saves
// confirmed (docs: game-knowledge and the specs in the notes).
import type { FlagKey, ListKey, RangeKey } from "../logic/filter-players.ts";
import { formatNumber } from "./text.ts";
import { pl } from "./typeset.ts";

const LEAGUE_STATS = pl`Liczby z zapisu kariery za bieżący sezon, z meczów ligi twojego klubu; gra zeruje je na początku sezonu. U zawodnika, który odszedł z twojej ligi, to liczby z czasu gry w niej.`;
const PRESTIGE = pl`Suma prestiżu ligi i prestiżu klubu wchodzi do wzorów gry na cenę i zarobki rynkowe: od 33 podnosi cenę o 10%, poniżej 25 ją obniża (o 35% przy 8 i mniej), a zarobki rosną z kwadratem tej sumy.`;
const CUP_STATS = pl`Liczby z zapisu kariery za bieżący sezon, z pucharów krajowych i europejskich razem; gra zeruje je na początku sezonu. Które puchary liczy, zależy od ligi twojego klubu, np. dla Ekstraklasy Puchar Polski, „Klubowe ME” i „Puchar EFA”.`;

export const FIELD_HELP: Partial<Readonly<Record<RangeKey | ListKey | FlagKey, string>>> = {
  positionGroup: pl`Pozycje zgrupowane według sposobu liczenia OVR w grze i miejsca na boisku: w jednej grupie te same wagi atrybutów. Skrzydłowy i boczny pomocnik mają też te same wagi, tak samo libero i boczny obrońca, ale grają w innym miejscu, więc są osobnymi grupami. Wagi libero gra sumuje w innej kolejności, więc jego OVR bywa o 1 inny niż bocznego obrońcy.`,
  weakFoot: pl`Gwiazdki z bazy gry, od 1 do 5: jak dobrze zawodnik gra słabszą nogą.`,
  age: pl`Wiek w dniu ostatniego meczu z zapisu kariery; bez zapisu 1 lipca 2009.`,
  overall: pl`OVR na pozycji preferowanej, liczony wzorem gry z atrybutów. Z zapisem kariery na wiek z pierwszej kolejki sezonu i z przyrostami atrybutów zapisanymi w karierze, tak jak liczy go gra; bez zapisu prosto z bazy gry.`,
  potential: pl`Limit rozwoju z bazy gry; gra tej liczby nie pokazuje. Gdy zawodnik trafia do twojego składu, gra podnosi go o 1 do 9 (szybkość nauki i reszta z dzielenia potencjału przez 5); u zawodników twojego składu narzędzie liczy z tą poprawką z zapisu. Zawodnicy rzadko go osiągają; realniejszy jest szczyt OVR.`,
  growth: pl`Potencjał minus OVR: ile brakuje do limitu potencjału (w karierze z poprawką z zapisu). Zawodnicy rzadko go osiągają; realniejszy jest szczyt OVR.`,
  peak: pl`OVR na szczycie rozwoju według krzywych gry, na pozycji preferowanej zawodnika albo, gdy zaznaczone jest pole poniżej, na jego najlepszej pozycji. Na pozycji preferowanej ten sam co na wykresie rozwoju w grze. Bez przyszłych przyrostów z meczów i treningu. Realniejszy cel niż potencjał, którego zawodnicy rzadko osiągają.`,
  peakGain: pl`Szczyt OVR minus OVR: ile zawodnik jeszcze urośnie według krzywych rozwoju gry. W filtrze z zaznaczonym polem przy szczycie OVR to szczyt na najlepszej pozycji minus dzisiejszy OVR na tej pozycji.`,
  bodyType: pl`Gra nie nazywa kodów. Przy podobnym wzroście typ 1 to średnio zawodnicy najlżejsi, typ 3 najciężsi.`,
  internationalReputation: pl`Gwiazdki z bazy gry, od 1 do 5. Według wzorów gry 4 i 5 gwiazdek podnoszą cenę i zarobki rynkowe; 1–3 gwiazdki ich nie zmieniają.`,
  learningSpeed: pl`Wartość z bazy gry. Gdy zawodnik trafia do twojego składu, gra dodaje ją do jego potencjału, razem z resztą z dzielenia potencjału przez 5.`,
  retirementAge: pl`Wiek z bazy gry. Zawodnik nie podpisze kontraktu, który sięgałby poza ten wiek (licząc jego wiek na koniec sezonu), a długość kontraktu, której chce, gra skraca do tej granicy.`,
  developmentType: pl`Kiedy zawodnik osiąga szczyt według krzywych rozwoju gry: wcześnie, w typowym wieku albo późno.`,
  developmentStyle: pl`Kształt krzywej rozwoju umiejętności: jak wysoko i jak długo rośnie. Krótka kariera szybko spada po szczycie, nagły skok rośnie gwałtownie w kilka sezonów.`,
  clubRating: pl`Ocena drużyny od 1 do 99 zapisana w danych gry. Gwiazdek klubu gra z niej nie liczy: wylicza je z OVR 16 najlepszych zawodników kadry.`,
  leaguePrestige: pl`Prestiż ligi klubu z bazy gry. ${PRESTIGE}`,
  clubPrestige: pl`Prestiż międzynarodowy klubu z bazy gry, w karierze też z płyty. ${PRESTIGE}`,
  clubStars: pl`Gwiazdki klubu od 0,5 do 5, liczone regułą gry z bieżącej kadry: średnia OVR 16 najlepszych zawodników (z pierwszych 30 w kadrze), zaokrąglona w dół; od 55 jedna gwiazdka, od 82 pięć. Z zapisem kariery z kadry i OVR w karierze, więc zmieniają się po transferach i rozwoju zawodników; bez zapisu z kadry na płycie.`,
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
  price: pl`Wartość według wzoru gry, jak CENA na liście rynku transferowego. Zależy m.in. od OVR, wieku, lat do końca kontraktu, reputacji i pozycji. Przy wygasłym kontrakcie i u wolnego zawodnika 0. U wypożyczonego zawodnika zapis nie trzyma kontraktu, więc ceny nie ma.`,
  wage: pl`Zarobki na mecz według wzoru gry, jak „Zarobki rynkowe” w formularzu oferty. Przy wygasłym kontrakcie (też w tym roku) z doliczonymi 30% (wolny transfer). Wzór nie odtwarza każdej pensji zapisanej w kontraktach, stąd szacunek. U zawodników twojego klubu zarobki z kontraktu zapisanego w karierze. U zawodników wypożyczonych z twojego klubu albo do niego zarobki z kontraktu, u innych wypożyczonych brak danych.`,
  transferListed: pl`Wystawiony na sprzedaż w oknie transferowym według zapisu kariery i jeszcze niesprzedany. Poza oknem transferowym ta lista jest pusta.`,
  loanListed: pl`Wystawiony do wypożyczenia w oknie transferowym według zapisu kariery i jeszcze niewypożyczony.`,
  clubWillSell: pl`Reguły z kodu gry: klub odrzuca każdą ofertę, gdy ma 19 lub mniej zawodników, za mało zawodników w grupie pozycji tego zawodnika albo gdy jest odwiecznym rywalem twojego klubu. „Tak” znaczy, że żadna z tych reguł nie blokuje oferty; jej warunki pokazuje karta zawodnika. Osobno gra odrzuca każdą ofertę, gdy twoja kadra ma 30 lub więcej zawodników. Pole nie dotyczy twoich zawodników ani wolnych zawodników.`,
};

/** Explanations of fields outside the keyed filters. */
export const HELP_TEXT = {
  /** The "?" button's name. */
  label: (field: string): string => `Wyjaśnienie: ${field}`,
  mark: "?",
  /** The season stats on the card. */
  career: pl`Gra prowadzi statystyki występów, goli, asyst i czystych kont w lidze twojego klubu i w pucharach, które liczy dla tej ligi (dla Ekstraklasy Puchar Polski, „Klubowe ME” i „Puchar EFA”), dla każdego klubu tych rozgrywek, i zeruje je na początku sezonu. U zawodnika z innej ligi to tylko mecze w europejskich pucharach. U zawodnika, który odszedł z twojej ligi, to liczby z czasu gry w niej. KR to nagłówek kolumny oceny na ekranie statystyk zawodnika w grze. Gra nie zeruje tej oceny na początku sezonu.`,
  positionRating: pl`OVR zawodnika na wybranej pozycji, liczony wagami atrybutów, których gra używa dla tej pozycji. Pozycje o tych samych wagach są jednym wyborem.`,
  ratingGain: pl`OVR na wybranej pozycji minus OVR na pozycji preferowanej. Dodatnia różnica: na tej pozycji zawodnik ma lepszą ocenę.`,
  bestPositionOnly: pl`Zostają tylko zawodnicy, którym wybrana pozycja daje największy OVR ze wszystkich pozycji; równy OVR na innej pozycji też się liczy.`,
  /** The peak at the position chosen in "Ocena na pozycji". */
  ratingPeak: pl`Szczyt OVR na tej pozycji według krzywych rozwoju gry, liczony jak szczyt OVR.`,
  /** The choice to count the peak at the best position, and the best peak on the card. */
  peakAtBest: pl`Szczyt liczy się osobno dla każdej pozycji; szczyt na najlepszej pozycji to największy z nich, a pozycja najlepsza dziś nie musi być najlepsza w szczycie. Zawodnik z OVR 72 jako napastnik i 68 jako prawy pomocnik może osiągnąć szczyt 82 jako napastnik i 83 jako prawy pomocnik; kolumna i filtr szczytu pokażą wtedy 83 i prawego pomocnika. Gdy kilka pozycji ma ten sam szczyt, wybór zawężają kolejno reguły: domyślnie pozycje z formacji twojego klubu w zapisie kariery, przy słabszej nodze na 4 lub 5 gwiazdek pozycje środkowe, pozycje po stronie lepszej nogi (gdy żadnej tam nie ma, środkowe przed przeciwną stroną) i pozycja preferowana. Reguła, której nie spełnia żadna z tych pozycji, niczego nie zmienia, a na końcu decyduje kolejność pozycji w grze. Kolejność reguł zmienisz w filtrach, pod polem szczytu na najlepszej pozycji. Pozostałe pozycje z tym samym szczytem karta wymienia pod wynikiem.`,
  /** One sentence per option of "Zawodnicy". */
  clubStatus: pl`„dostępni w karierze” to zawodnicy z klubem, wolni zawodnicy i juniorzy (z twojej akademii albo wyszukani przez skautów i jeszcze niepodpisani). „tylko z klubem” to zawodnicy z klubem, bez wolnych zawodników i bez juniorów spoza klubu. „tylko wolni” to zawodnicy bez klubu; ich wartość (cena) to 0, a zarobki rynkowe gra liczy im z doliczonymi 30%. „niedostępni w karierze” to zawodnicy, których gra łączy tylko z kadrą reprezentacji (albo z World XI), bez klubu; narzędzie nie sprawdziło w grze, czy kariera pozwala ich podpisać.`,
  /** One sentence per option of "Na liście". */
  onList: pl`„dowolne” nie zawęża listy. „w grze” to zawodnicy z listy życzeń w grze, odczytanej z zapisu kariery. „w narzędziu” to zawodnicy z twojej listy z tego narzędzia, zapisanej w tej przeglądarce; gra o niej nie wie. „w obu” to zawodnicy z obu tych list naraz. „na żadnej” to zawodnicy spoza obu list. „w grze” i „w obu” wymagają zapisu kariery.`,
  /** The card's offer section. */
  offer: pl`Z kodu gry: najniższa kwota, którą klub przyjmie, i najniższe zarobki, za które zawodnik podpisze kontrakt na wybranych warunkach. Uwzględnia twój prestiż menedżera i poziom negocjatora z zapisu: wyższy może obniżyć kwotę dla klubu i zawsze ułatwia rozmowy z zawodnikiem. Na początku jest zwykła oferta, bez premii, na długość kontraktu, której chce zawodnik. Podwójna oferta, premia i inna długość zmieniają punkty zawodnika, a z nimi najniższe zarobki. Zarobki mają zapas jednego punktu: średnia OVR twojego składu, z którą gra porównuje zawodnika, bywa o 1 niższa niż odczytana z zapisu, a wtedy oferta dokładnie na granicy przepada.`,
  doubleOffer: pl`Podwójna oferta daje zawodnikowi 2 punkty i kosztuje 2 z „Pozostało ofert” zamiast 1.`,
  /** The own list on the card. */
  watchlist: pl`Lista zapisuje się w tej przeglądarce przy każdej zmianie. Usunięcie zawodnika z listy nie usuwa jego notatki.`,
  /** The note on the card. */
  note: pl`Notatkę możesz dodać każdemu zawodnikowi; nie dodaje go do twojej listy w narzędziu. Zapisuje się w tej przeglądarce przy każdej zmianie, a wszystkie notatki otworzysz przyciskiem „Notatki” na górze strony. Pusta notatka znika.`,
  /** The player's skill curve on the card, peaking at `peakAge`. */
  curve: (peakAge: number): string =>
    pl`Krzywa z danych gry według typu i stylu rozwoju zawodnika: względny poziom jego umiejętności technicznych w wieku od 15 do 45 lat, na jednej skali dla wszystkich krzywych, więc ich kształty można porównać. Obok krzywej faza zawodnika w tym sezonie: przed szczytem, w szczycie albo po nim. Przycisk z krzywą otwiera duży wykres z opisem. Szczyt w wieku ${peakAge} lat.`,
  /** The large chart's phase: the rule for the peak's ages. */
  curvePhase: pl`Okres szczytu to wiek, w którym krzywa ma co najmniej 98% swojego maksimum; wykres zaznacza go tłem, bo niektóre krzywe są płaskie przez kilka lat. Faza mówi, czy wiek zawodnika w tym sezonie przypada przed tym okresem, w nim czy po nim.`,
  /** The large chart's level axis. */
  curveLevel: pl`Gra liczy umiejętności techniczne zawodnika z wartości w bazie danych proporcjonalnie do tej krzywej: wartość z bazy odpowiada poziomowi krzywej w jego wieku na 1 stycznia 2009, a w innym wieku rośnie albo maleje w tej samej proporcji, nie wyżej niż 99 i potencjał (albo wyższa od niego wartość z bazy). Poziom 43 rosnący do 100 oznacza więc, że te umiejętności urosną do ponad dwukrotności. Umiejętności fizyczne (przyspieszenie, szybkość, refleks, wytrzymałość, siła) idą za inną krzywą, zależną tylko od typu rozwoju.`,
} as const;

/** Notes behind the "!" before a value: what holds for this player and asks for attention. */
export const WARNING_TEXT = {
  /** The "!" button's name. */
  label: (field: string): string => `Uwaga: ${field}`,
  mark: "!",
  peakBelowPotential: (potential: number): string =>
    pl`Potencjału ${formatNumber(potential)} zawodnik według prognozy szczytu nie osiągnie.`,
  feeOverCap: pl`Kwota przekracza limit formularza przy pierwszej ofercie (1,5 wartości). Ponowna oferta po odmowie liczy limit od poprzedniej oferty: do 1,5 jej kwoty.`,
  wageOverCap: pl`Zarobki przekraczają limit formularza przy pierwszej ofercie (1,5 zarobków rynkowych). Ponowna oferta po odmowie liczy limit od poprzedniej oferty: do 1,5 jej zarobków.`,
} as const;
