/** Every text the user reads, in one module, with the Polish number and plural helpers. */
import type { CurrencyCode } from "../data/career-save.ts";
import type { CareerSummary } from "../logic/load-scout.ts";
import type { FlagKey, ListKey, PeakTwin, RangeFields, RangeKey } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/attributes.ts";
import type { PositionGroup } from "../logic/positions.ts";
import { lazy } from "../logic/lazy.ts";
import { ATTRIBUTE_LABELS } from "./text-attributes.ts";
import { NBSP, pl } from "./typeset.ts";

/** By the save's currency code, as the game shows them. */
const CURRENCY_SYMBOLS = ["€", "£", "$"] as const;

export interface PluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
}

const pluralRules = lazy(() => new Intl.PluralRules("pl"));
const numberFormat = lazy(() => new Intl.NumberFormat("pl-PL"));

/** The decimal separator of the interface language (a comma in Polish), for typed decimals. */
export const decimalSeparator = lazy(
  () =>
    numberFormat()
      .formatToParts(1.5)
      .find((part) => part.type === "decimal")?.value ?? ",",
);

/** The Polish noun form for an integer count: 1 rok, 2–4 lata, 5–21 lat, 22–24 lata. */
export const plural = (count: number, forms: PluralForms): string => {
  const category = pluralRules().select(count);
  return category === "one" ? forms.one : category === "few" ? forms.few : forms.many;
};

export const formatNumber = (value: number): string => numberFormat().format(value);

const ratingFormat = lazy(
  () => new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);

/** A match rating with one decimal, as the game's stats screen shows it: 6,9 and 7,0. */
export const formatRating = (value: number): string => ratingFormat().format(value);

const MINUS = "−";

/** A difference with its sign: +3, −2 (minus sign), 0. */
const signed = (value: number): string =>
  value > 0
    ? `+${formatNumber(value)}`
    : value < 0
      ? `${MINUS}${formatNumber(-value)}`
      : formatNumber(0);

/** Game dates are calendar days, stored as UTC midnight: "8 sierpnia 2009". */
const longDate = lazy(() => new Intl.DateTimeFormat("pl", { dateStyle: "long", timeZone: "UTC" }));

const lastGame = (date: Date | null): string =>
  date === null ? "przed pierwszym meczem" : `ostatni mecz ${longDate().format(date)}`;

const count = (value: number, forms: PluralForms): string =>
  `${formatNumber(value)}${NBSP}${plural(value, forms)}`;

const PLAYERS = { one: "zawodnik", few: "zawodników", many: "zawodników" } as const;
const YEARS = { one: "rok", few: "lata", many: "lat" } as const;

// Label tables: plain data that only the literal-blind duplicate check sees as alike.
// jscpd:ignore-start
export const POSITION_GROUP_LABELS: Readonly<Record<PositionGroup, string>> = {
  goalkeeper: "Bramkarz",
  "full-backs": "Boczny obrońca",
  "wing-backs": "Wahadłowy",
  sweeper: "Libero",
  "centre-backs": "Środkowy obrońca",
  "defensive-midfield": "Defensywny pomocnik",
  "central-midfield": "Środkowy pomocnik",
  "attacking-midfield": "Ofensywny pomocnik",
  "side-midfield": "Boczny pomocnik",
  wingers: "Skrzydłowy",
  forwards: "Napastnik",
};

export const RANGE_LABELS: Readonly<Record<RangeFields | PeakTwin, string>> = {
  age: "Wiek",
  overall: "OVR",
  potential: "Potencjał",
  growth: "Zapas rozwoju",
  peak: "Szczyt OVR",
  peakGain: "Zapas do szczytu",
  bestPeak: "Najlepszy szczyt",
  bestPeakGain: "Zapas do najlepszego szczytu",
  height: "Wzrost (cm)",
  weight: "Waga (kg)",
  weakFoot: "Słabsza noga (1–5)",
  internationalReputation: "Reputacja międzynarodowa (1–5)",
  learningSpeed: "Szybkość nauki (1–5)",
  retirementAge: "Wiek zakończenia kariery",
  clubRating: "Siła klubu",
  clubStars: "Gwiazdki klubu",
  leaguePrestige: "Prestiż ligi",
  clubPrestige: "Prestiż klubu",
  contractEndYear: "Kontrakt",
  contractYearsLeft: "Lata kontraktu",
  form: "KR (forma)",
  morale: "Morale",
  totalAppearances: pl`Występy ogółem`,
  totalGoals: pl`Gole ogółem`,
  totalAssists: pl`Asysty ogółem`,
  totalCleanSheets: pl`Czyste konta ogółem`,
  appearances: pl`Występy w lidze`,
  goals: pl`Gole w lidze`,
  cupAppearances: pl`Występy w pucharach`,
  cupGoals: pl`Gole w pucharach`,
  assists: pl`Asysty w lidze`,
  cupAssists: pl`Asysty w pucharach`,
  cleanSheets: pl`Czyste konta w lidze`,
  cupCleanSheets: pl`Czyste konta w pucharach`,
  injuryDays: "Kontuzja (dni)",
  price: "Cena",
  wage: "Zarobki rynkowe (szacunkowe)",
};

export const rangeLabel = (key: RangeKey | PeakTwin): string =>
  isAttributeName(key) ? ATTRIBUTE_LABELS[key] : RANGE_LABELS[key];

export const LIST_LABELS: Readonly<Record<ListKey, string>> = {
  positionGroup: "Pozycje",
  positionCode: "Pozycje szczegółowe",
  bodyType: "Typ budowy",
  preferredFoot: "Lepsza noga",
  developmentType: "Typ rozwoju",
  developmentStyle: "Styl rozwoju",
  leagueId: "Liga",
  clubId: "Klub",
  nationalityId: "Narodowość",
};

export const FLAG_LABELS: Readonly<Record<FlagKey, string>> = {
  injuryprone: "Podatny na kontuzje",
  adaptability: "Łatwo się aklimatyzuje",
  ambition: "Ambitny",
  comesforcrosses: "Wychodzi do dośrodkowań",
  diver: "Symulant",
  divesintotackles: "Ryzykowne wślizgi",
  earlycrosser: "Wczesne dośrodkowania",
  fansfavourite: "Ulubieniec kibiców",
  flexibility: "Elastyczny",
  highclubidentification: pl`Silnie związany z klubem`,
  hightrainingworkrate: "Pracowity na treningu",
  holdsup: "Utrzymuje piłkę",
  inflexible: "Mało elastyczny",
  latecrosser: "Późne dośrodkowania",
  leadership: "Lider",
  longshottaker: pl`Często strzela z dystansu`,
  longthrows: pl`Długie wrzuty z autu`,
  lowclubidentification: pl`Słabo związany z klubem`,
  lowconcentration: "Słaba koncentracja",
  lowtrainingworkrate: "Mało pracowity na treningu",
  mediadarling: "Ulubieniec mediów",
  onetimepasser: "Gra na jeden kontakt",
  playmaker: "Rozgrywający",
  puncher: "Piąstkuje",
  pushesupforcorners: "Idzie pod bramkę przy rożnych",
  rushesoutofgoal: pl`Wychodzi z bramki`,
  scandalprone: "Skłonny do skandali",
  selfish: "Samolubny",
  staysongoalline: "Zostaje na linii",
  technicaldribbler: "Drybler techniczny",
  nationalTeam: "Reprezentant kraju",
  retiring: pl`Kończy karierę po sezonie`,
  transferListed: "Na liście transferowej",
  loanListed: "Na liście do wypożyczenia",
  loaned: "Wypożyczony",
  clubWillSell: "Klub może go sprzedać",
};

export const FILTER_SECTION_LABELS = {
  basic: "Podstawowe",
  physique: "Sylwetka",
  attributes: "Atrybuty",
  traits: "Cechy",
  character: pl`Charakter i renoma`,
  club: pl`Klub i kontrakt`,
  career: "Kariera",
} as const;

// jscpd:ignore-end

export const TEXT = {
  traitsNote: pl`Cechy pochodzą z bazy gry. Czy wpływają na rozgrywkę w wersji PSP, nie jest potwierdzone.`,
  appTitle: pl`PSP FIFA 10 Scout`,
  showFiles: "Pliki",
  showList: "Lista zawodników",
  startHeading: "Wczytaj pliki",
  startIntro: "Pliki zostają na tym urządzeniu. Nic nie jest wysyłane.",
  gameStep: pl`1. Plik gry`,
  gameInput: "Wybierz obraz ISO lub fifa.db",
  gameHelpPhone: pl`iPhone: w aplikacji Pliki otwórz folder PPSSPP, potem PSP/GAME, i wybierz obraz ISO gry.`,
  gameHelpPc: "PC: obraz ISO leży tam, gdzie trzymasz gry dla PPSSPP.",
  gameStored: "Wybierz plik ponownie tylko po zmianie gry.",
  gameLoaded: (name: string | null): string =>
    name === null ? "Zapamiętana baza gry" : `Wczytano: ${name}`,
  showPlayers: (value: number): string => `Pokaż zawodników (${formatNumber(value)})`,
  preparing: "Przygotowuję aplikację…",
  saveStep: pl`2. Zapis kariery (opcjonalnie)`,
  saveInput: pl`Wybierz DATA.BIN i PARAM.SFO`,
  saveHelp: pl`Zapis kariery jest zwykle w folderze PSP/SAVEDATA/ULES01328081 (iPhone: Pliki, folder PPSSPP). Zaznacz razem DATA.BIN i PARAM.SFO. Zapis zostaje na tym urządzeniu do usunięcia albo wyboru innego.`,
  saveFolders: pl`DATA.BIN kariery ma około 540 KB. Foldery kończące się na 001 (profil, około 36 KB) i 021 (składy, około 270 KB) to inne zapisy.`,
  careerLoaded: ({ managerName, clubName, lastGameDate }: CareerSummary): string =>
    `Kariera: ${managerName}, ${clubName ?? "bez klubu"}, ${lastGame(lastGameDate)}`,
  forgetSave: "Usuń zapis kariery",
  languageStep: pl`3. Język nazw`,
  languageSelect: pl`Nazwy klubów, lig i krajów`,
  languageFromDb: pl`Angielskie z bazy fifa.db`,
  languageHelp: pl`Obraz ISO zawiera nazwy we wszystkich językach gry; po jego wczytaniu wybierz język z listy.`,
  localeInput: pl`Albo dołącz plik języka i string.idx`,
  currencyStep: pl`4. Waluta`,
  currencySelect: pl`Ceny i zarobki w walucie`,
  currencyFromCareer: (code: CurrencyCode): string => `Jak w karierze (${CURRENCY_SYMBOLS[code]})`,
  /** In the order of the game's menu. */
  currencies: [
    [1, "Funt (£)"],
    [0, "Euro (€)"],
    [2, "Dolar ($)"],
  ] as const satisfies readonly (readonly [CurrencyCode, string])[],
  currencyHelp: pl`Kwoty są liczone kursem i zaokrągleniem gry, tak jakby twoja kariera używała tej waluty. W walucie innej niż ta z kariery nie zgadzają się z ekranami gry.`,
  localeHelp: pl`Pliki leżą w obrazie ISO w PSP_GAME/USRDIR/data/gui/locale, np. pol_pl.loc. Zaznacz plik języka razem ze string.idx z tego samego folderu.`,
  resultCount: (value: number): string => count(value, PLAYERS),
  installHeading: "Aplikacja na ekranie początkowym",
  /** Left out once the app could not be stored for offline use. */
  installOffline: pl`Po pierwszym otwarciu narzędzie działa też bez internetu.`,
  installSteps: pl`iPhone: w Safari wybierz Udostępnij, potem Do ekranu początkowego. Chrome i Edge: menu przeglądarki, potem Zainstaluj aplikację.`,
  update: {
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
  },
  storageFailed: pl`Nie udało się użyć pamięci przeglądarki. Narzędzie działa dalej, ale filtry i wczytane pliki mogą nie zostać zapamiętane. Po ponownym otwarciu wczytaj pliki jeszcze raz.`,
  noData: "Nie wczytano jeszcze bazy gry.",
  noMatches: "Żaden zawodnik nie spełnia filtrów.",
  filters: "Filtry",
  showPotential: "Pokaż potencjał",
  /** Under the potential switch while it is off: the tool's main use, so it says so (owner, 2026-11-11). */
  showPotentialAdvice: {
    lead: "Zalecane.",
    text: pl`Gra nie pokazuje potencjału; to pole go pokazuje, a z zapisem kariery także szczyt OVR i zapas do szczytu.`,
  },
  /** The switch to values after signing, its "?" and what it says while the list is built (roadmap 56). */
  afterSigning: {
    label: pl`Wartość po podpisaniu`,
    help: pl`Zawodnicy spoza twojego składu z wartościami, jakie gra da im po podpisaniu: przy wejściu do twojego składu potencjał rośnie o szybkość nauki plus resztę z dzielenia potencjału przez 5 (razem od 1 do 9), więc OVR, szczyty i cena, które stały na potencjale, rosną razem z nim. Filtry, sortowanie, kolumny i karta liczą wtedy z tych wartości; formularz oferty dalej liczy dla zawodnika przed transferem. Pierwsze włączenie po wczytaniu plików liczy listę kilka sekund.`,
    pending: pl`Liczę wartości po podpisaniu…`,
    failed: pl`Nie udało się policzyć wartości po podpisaniu; lista pokazuje wartości sprzed podpisania.`,
  },
  positionRating: "Ocena na pozycji",
  ratingAt: (position: string): string => `OVR ${position}`,
  ratingChoice: (group: string, abbreviation: string): string => `${group} (${abbreviation})`,
  /** Group labels joined, the later ones in lower case: "Boczny pomocnik / skrzydłowy". */
  groupList: (labels: readonly string[]): string =>
    labels.map((label, index) => (index === 0 ? label : label.toLocaleLowerCase("pl"))).join(" / "),
  ratingGain: "Różnica do OVR",
  /** A price or wage label with the shown currency (once for a column or a filter); others as they are. */
  withCurrency: (key: string, label: string, currency: CurrencyCode | null): string =>
    (key === "price" || key === "wage") && currency !== null
      ? `${label} (${CURRENCY_SYMBOLS[currency]})`
      : label,
  gainAt: (position: string): string => `Różnica ${position}`,
  ratingGainShort: "różnica",
  peakAt: (position: string): string => `Szczyt ${position}`,
  ratingPeakShort: "szczyt",
  peakAtBest: "Szczyt OVR na jego najlepszej pozycji",
  /** The order of the rules that break a best peak tie, and its buttons. */
  tieOrder: pl`Przy remisie szczytu wybieraj według`,
  tieRuleUp: (rule: string): string => `W górę: ${rule}`,
  tieRuleDown: (rule: string): string => `W dół: ${rule}`,
  upMark: "↑",
  downMark: "↓",
  tieOrderDefault: pl`Przywróć domyślną kolejność`,
  bestPositionOnly: "Tylko jego najlepsza pozycja",
  bestPositionShort: "najlepsza pozycja",
  signed: (value: number): string => signed(value),
  text: "Nazwisko",
  clubStatus: "Zawodnicy",
  onList: pl`Na liście`,
  myClub: "Mój klub",
  addAttribute: "Dodaj atrybut",
  chooseAttribute: "Wybierz atrybut",
  removeAttribute: (label: string): string => `Usuń atrybut: ${label}`,
  searchIn: (label: string): string => `Szukaj: ${label}`,
  /** A list filter turned round: everyone but the chosen values. */
  excludeChosen: "Wszystkie oprócz zaznaczonych",
  chipExcluded: (values: string): string => `oprócz ${values}`,
  flagValues: { any: "obojętne", yes: "tak", no: "nie" },
  chip: (label: string, value: string): string => `${label}: ${value}`,
  /** A chip's values: the first ones by name, then how many more ("Argentina, Brazil +2"). */
  chipValues: (shown: readonly string[], more: number): string =>
    more > 0 ? `${shown.join(", ")} +${String(more)}` : shown.join(", "),
  /** The parts of one chip value, as the position rating's position, bounds and gain. */
  chipParts: (parts: readonly string[]): string => parts.join(", "),
  /** The text from a capital letter, as a chip starts. */
  capitalized: (text: string): string => text.charAt(0).toLocaleUpperCase("pl") + text.slice(1),
  filtersWithCount: (value: number): string =>
    value === 0 ? "Filtry" : `Filtry (${String(value)})`,
  resetFilters: "Wyczyść filtry",
  /** Takes back the last change of the filters, the sort or the saved sets. */
  undo: "Cofnij",
  /** Filters, sort, columns and the potential switch back to their defaults, after a question. */
  resetSettings: "Resetuj",
  resetQuestion: pl`Przywrócić domyślne filtry, sortowanie, kolumny, kolejność reguł remisu szczytu i widok bez potencjału? Wgrane pliki, język nazw i zapisane zestawy zostaną.`,
  cancel: "Anuluj",
  /** Clears one field's filter; the label names the field for screen readers. */
  /** A mark right after a field's name (owner, 2026-11-05: an icon, not a word); the label names it. */
  clearField: "×",
  clearFieldLabel: (label: string): string => `Wyczyść: ${label}`,
  /** The eye that shows or hides a filter's column, pressed while it shows. */
  columnToggleLabel: (label: string): string => `Pokaż kolumnę: ${label}`,
  removeFilter: (label: string): string => `Usuń filtr: ${label}`,
  activeFilters: "Aktywne filtry",
  activeFiltersCount: (value: number): string => `Aktywne filtry (${String(value)})`,
  removeMark: "×",
  sortMark: { ascending: "▲", descending: "▼" },
  rowMetaSeparator: " · ",
  /** The same at the start of a part of the phone row's line, where an ordinary space would collapse. */
  rowMetaPartSeparator: `${NBSP}·${NBSP}`,
  shortlistedMark: "★",
  /** A list cell without a value, and its name for screen readers. */
  missingMark: "–",
  missingValue: "brak danych",
  shortlisted: pl`na liście życzeń w grze`,
  /** The own list's star in words, after the name. */
  watched: pl`na twojej liście w narzędziu`,
  anyOption: "Dowolna",
  min: "od",
  max: "do",
  contractEndsBy: "Kontrakt kończy się najpóźniej w",
  sortBy: "Sortuj według",

  sortAscending: "rosnąco",
  sortDescending: "malejąco",
  /** A column's label with the direction it is sorted in, as its sort button's name. */
  sortedBy: (label: string, direction: "ascending" | "descending"): string =>
    `${label}, ${direction === "ascending" ? "rosnąco" : "malejąco"}`,
  // A record of labels, alike line by line: jscpd reads it as a copy of itself shifted by a line.
  // jscpd:ignore-start
  columns: {
    name: "Zawodnik",
    age: "Wiek",
    positionCode: "Poz.",
    clubName: "Klub",
    leagueName: "Liga",
    nationalityName: "Narodowość",
    contractEndYear: "Kontrakt do",
    price: "Cena",
    overall: "OVR",
    potential: "Potencjał",
    positionGroup: "Grupa pozycji",
    preferredFoot: "Noga",
    bodyType: "Budowa",
    developmentType: "Typ rozwoju",
    developmentStyle: "Styl rozwoju",
  },
  // jscpd:ignore-end
  potentialShort: "POT",
  freeAgent: "wolny zawodnik",
  youth: "junior",
  noContract: "bez kontraktu",
  years: (value: number): string => count(value, YEARS),
  close: "Zamknij",
  card: {
    position: "Pozycja",
    age: "Wiek",
    club: "Klub",
    league: "Liga",
    nationality: "Narodowość",
    contract: "Kontrakt do",
    potential: "Potencjał",
    peak: "Szczyt OVR",
    bestPeak: "Szczyt na najlepszej pozycji",
    /** Under the best peak: the other positions, by their abbreviations, with the same peak. */
    samePeakAlso: (positions: readonly string[]): string =>
      `ten sam szczyt także na: ${positions.join(", ")}`,
    peakNote: pl`Szczyt OVR na pozycji preferowanej zawodnika: prognoza z krzywych rozwoju gry, ta sama co na jej wykresie rozwoju; nie obejmuje przyszłych przyrostów z meczów i treningu. Realniejszy cel niż potencjał, którego zawodnicy rzadko osiągają.`,
    overallByGroup: "OVR na pozycjach",
    showPeaks: "Pokaż szczyt OVR",
    peakAtChoice: (peak: number): string => `szczyt ${String(peak)}`,
    openMark: "▾",
    closedMark: "▸",
    positionWithName: (name: string, abbreviation: string): string => `${name} (${abbreviation})`,
    /** The gain over the OVR before a rating, in brackets, with the space before the rating. */
    gain: (value: number): string => `(${signed(value)}) `,
    foot: "Lepsza noga",
    weakFoot: "Słabsza noga",
    starsOutOfFive: (stars: number): string => `${formatNumber(stars)} z 5 gwiazdek`,
    profile: "Profil",
    internationalReputation: "Reputacja międzynarodowa",
    learningSpeed: "Szybkość nauki",
    curve: "Krzywa rozwoju",
    /** The small curve's button, which opens the large chart, and that chart's dialog. */
    showCurve: (name: string): string => `Pokaż krzywą rozwoju: ${name}`,
    curveTitle: (name: string): string => `Krzywa rozwoju: ${name}`,
    /** The large chart's axes and the legend under it, which names each mark once. */
    curveAge: "Wiek",
    curveValue: "Poziom umiejętności",
    curveOvr: "OVR",
    legendNow: (age: number, phase: string, overall: number | null): string =>
      pl`wiek w tym sezonie: ${count(age, YEARS)}, ${phase}` +
      (overall === null ? "" : `, OVR ${formatNumber(overall)}`),
    legendPlateau: (from: number, to: number): string =>
      `okres szczytu: ${from === to ? count(from, YEARS) : `${String(from)}–${count(to, YEARS)}`}`,
    legendPeak: (age: number, value: number, ovr: boolean): string =>
      `szczyt: ${count(age, YEARS)}, ${ovr ? "OVR" : "poziom"} ${formatNumber(value)}`,
    /** Where his age this season falls on the curve: before, within or after the peak's ages. */
    curvePhases: {
      before: "przed szczytem",
      peak: pl`w szczycie`,
      after: "po szczycie",
    },
    yes: "tak",
    no: "nie",
    left: "lewa",
    right: "prawa",
    height: "Wzrost",
    weight: "Waga",
    heightValue: (cm: number): string => `${formatNumber(cm)}${NBSP}cm`,
    weightValue: (kg: number): string => `${formatNumber(kg)}${NBSP}kg`,
    career: pl`W tym sezonie kariery`,
    loanedFrom: "Wypożyczony z",
    /** The club a loaned player plays for, with the loan noted. */
    onLoanAt: (club: string): string => `${club} (wypożyczenie do końca sezonu)`,
    parentClubRating: "Siła klubu macierzystego",
    price: "Cena",
    wage: RANGE_LABELS.wage,
    contractWage: pl`Zarobki z kontraktu`,
    /** A loaned player's prospects once back at his parent club: the renewal's draw and the prices for it. */
    returnContract: pl`Kontrakt po powrocie`,
    returnContractYears: pl`od 1 do 5 lat, losowo`,
    returnPrice: pl`Cena po powrocie (prognoza)`,
    moneyRange: (lowest: string, highest: string): string =>
      lowest === highest ? lowest : `${lowest} – ${highest}`,
    shortlisted: pl`Na twojej liście życzeń w grze`,
    watched: pl`Na twojej liście w narzędziu`,
    money: (amount: number, currency: CurrencyCode): string =>
      `${formatNumber(amount)}${NBSP}${CURRENCY_SYMBOLS[currency]}`,
    none: "brak",
  },
} as const;
