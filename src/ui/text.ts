/** Every text the user reads, in one module, with the Polish number and plural helpers. */
import type { CurrencyCode } from "../data/career-save.ts";
import type { CareerSummary, LoadErrorKind, LoadPhase, LoadStage } from "../logic/load-scout.ts";
import type { FlagKey, ListKey, RangeFields } from "../logic/filter-players.ts";
import type { AttributeName } from "../logic/players.ts";
import type { PositionGroup } from "../logic/positions.ts";
import type { ClubStatus, MyClub, ScoutError } from "../logic/scout-state.ts";
import { NBSP, pl } from "./typeset.ts";

/** By the save's currency code, as the game shows them. */
const CURRENCY_SYMBOLS = ["€", "£", "$"] as const;

export interface PluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
}

const pluralRules = new Intl.PluralRules("pl");
const numberFormat = new Intl.NumberFormat("pl-PL");

/** The decimal separator of the interface language (a comma in Polish), for typed decimals. */
export const DECIMAL_SEPARATOR =
  numberFormat.formatToParts(1.5).find((part) => part.type === "decimal")?.value ?? ",";

/** The Polish noun form for an integer count: 1 rok, 2–4 lata, 5–21 lat, 22–24 lata. */
export const plural = (count: number, forms: PluralForms): string => {
  const category = pluralRules.select(count);
  return category === "one" ? forms.one : category === "few" ? forms.few : forms.many;
};

export const formatNumber = (value: number): string => numberFormat.format(value);

const ratingFormat = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** A match rating with one decimal, as the game's stats screen shows it: 6,9 and 7,0. */
export const formatRating = (value: number): string => ratingFormat.format(value);

const MINUS = "−";

/** A difference with its sign: +3, −2 (minus sign), 0. */
const signed = (value: number): string =>
  value > 0
    ? `+${formatNumber(value)}`
    : value < 0
      ? `${MINUS}${formatNumber(-value)}`
      : formatNumber(0);

/** Game dates are calendar days, stored as UTC midnight. */
const dateFormat = new Intl.DateTimeFormat("pl", { dateStyle: "long", timeZone: "UTC" });

/** A game date the Polish way: "8 sierpnia 2009". */
const formatDate = (date: Date): string => dateFormat.format(date);

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

export const ATTRIBUTE_LABELS: Readonly<Record<AttributeName, string>> = {
  acceleration: "Przyspieszenie",
  aggression: "Agresja",
  ballcontrol: "Kontrola piłki",
  crossing: "Dośrodkowania",
  dribbling: "Drybling",
  finishing: "Wykończenie",
  freekicks: "Rzuty wolne",
  heading: "Gra głową",
  longpassing: "Długie podania",
  longshotaccuracy: pl`Strzały z dystansu`,
  marking: "Krycie",
  playercomposure: "Opanowanie",
  positioning: "Ustawianie się",
  reactions: "Reakcje",
  shortpassing: "Krótkie podania",
  shotpower: "Siła strzału",
  sprintspeed: "Szybkość",
  stamina: "Wytrzymałość",
  strength: "Siła",
  tackling: "Odbiór",
  tacticalawareness: "Świadomość taktyczna",
  gkdiving: "Parady",
  gkpositioning: "Ustawianie bramkarza",
  handling: "Chwytanie",
  reflexes: "Refleks",
};

export const ATTRIBUTE_GROUP_LABELS = {
  physical: "Fizyczne",
  technique: "Technika",
  shooting: "Strzały",
  mental: "Mentalne",
  defending: "Obrona",
  goalkeeping: "Bramkarz",
} as const;

export const RANGE_LABELS: Readonly<Record<RangeFields, string>> = {
  age: "Wiek",
  overall: "OVR",
  potential: "Potencjał",
  growth: "Zapas rozwoju",
  peak: "Szczyt OVR",
  peakGain: "Zapas do szczytu",
  height: "Wzrost (cm)",
  weight: "Waga (kg)",
  weakFoot: "Słabsza noga (1–5)",
  internationalReputation: "Reputacja międzynarodowa (1–5)",
  learningSpeed: "Szybkość nauki (1–5)",
  retirementAge: "Wiek zakończenia kariery",
  clubRating: "Siła klubu",
  contractEndYear: "Kontrakt",
  form: "Średnia ocena (KR)",
  morale: "Morale",
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
  wage: "Zarobki rynkowe (szacunek)",
};

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
  transferListed: "Na liście transferowej",
  loanListed: "Na liście do wypożyczenia",
  loaned: "Wypożyczony",
  shortlisted: pl`Na liście życzeń w grze`,
  onMyList: pl`Na mojej liście`,
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

export const MY_CLUB_LABELS: Readonly<Record<"all" | MyClub, string>> = {
  all: "wszyscy zawodnicy",
  hide: "ukryj zawodników mojego klubu",
  only: "tylko zawodnicy mojego klubu",
};

export const CLUB_STATUS_LABELS: Readonly<Record<ClubStatus, string>> = {
  available: pl`do sprowadzenia (z klubem i wolni)`,
  "free-agents": "tylko wolni zawodnicy",
};

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
    `Kariera: ${managerName}, ${clubName ?? "bez klubu"}, ostatni mecz ${formatDate(lastGameDate)}`,
  forgetSave: "Usuń zapis kariery",
  phase: (phase: LoadPhase): string => PHASES[phase],
  error: (error: ScoutError): string =>
    `${STAGES[error.stage]}: ${
      error.stage === "locale" && error.kind === "missing-file"
        ? LOCALE_MISSING
        : ERRORS[error.kind]
    }`,
  languageStep: pl`3. Język nazw`,
  languageSelect: pl`Nazwy klubów, lig i krajów`,
  languageFromDb: pl`Angielskie z bazy fifa.db`,
  languageHelp: pl`Obraz ISO zawiera nazwy we wszystkich językach gry; po jego wczytaniu wybierz język z listy.`,
  localeInput: pl`Albo dołącz plik języka i string.idx`,
  localeHelp: pl`Pliki leżą w obrazie ISO w PSP_GAME/USRDIR/data/gui/locale, np. pol_pl.loc. Zaznacz plik języka razem ze string.idx z tego samego folderu.`,
  resultCount: (value: number): string => count(value, PLAYERS),
  installHeading: "Aplikacja na ekranie początkowym",
  installHelp: pl`Po pierwszym otwarciu narzędzie działa też bez internetu. iPhone: w Safari wybierz Udostępnij, potem Do ekranu początkowego. Chrome i Edge: menu przeglądarki, potem Zainstaluj aplikację.`,
  update: {
    waiting: pl`Dostępna jest nowa wersja. Wczytane dane gry, zapis kariery i filtry zostaną zachowane.`,
    installing: "Instalowanie nowej wersji…",
    outdated: pl`Nowa wersja została zainstalowana w innym oknie. Wczytane dane gry, zapis kariery i filtry zostaną zachowane.`,
    failed: "Nie udało się pobrać nowej wersji. Spróbuj później.",
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
  noData: "Nie wczytano jeszcze bazy gry.",
  noMatches: "Żaden zawodnik nie spełnia filtrów.",
  filters: "Filtry",
  showPotential: "Pokaż potencjał",
  positionRating: "Ocena na pozycji",
  ratingAt: (position: string): string => `OVR ${position}`,
  ratingChoice: (group: string, abbreviation: string): string => `${group} (${abbreviation})`,
  /** Group labels joined, the later ones in lower case: "Boczny pomocnik / skrzydłowy". */
  groupList: (labels: readonly string[]): string =>
    labels.map((label, index) => (index === 0 ? label : label.toLocaleLowerCase("pl"))).join(" / "),
  ratingGain: "Różnica do OVR",
  /** A price or wage label with the career's currency (once for a column or a filter); others as they are. */
  withCurrency: (key: string, label: string, currency: CurrencyCode | null): string =>
    (key === "price" || key === "wage") && currency !== null
      ? `${label} (${CURRENCY_SYMBOLS[currency]})`
      : label,
  gainAt: (position: string): string => `Różnica ${position}`,
  ratingGainShort: "różnica",
  peakAt: (position: string): string => `Szczyt ${position}`,
  ratingPeakShort: "szczyt",
  bestPositionOnly: "Tylko jego najlepsza pozycja",
  bestPositionShort: "najlepsza pozycja",
  signed: (value: number): string => signed(value),
  text: "Nazwisko",
  clubStatus: "Zawodnicy",
  myClub: "Mój klub",
  addAttribute: "Dodaj atrybut",
  attributeGroups: "Grupy atrybutów",
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
  /** Filters, sort and the potential switch back to their defaults, after a question. */
  resetSettings: "Resetuj",
  resetQuestion: pl`Przywrócić domyślne filtry, sortowanie i widok bez potencjału? Wgrane pliki, język nazw i zapisane zestawy zostaną.`,
  cancel: "Anuluj",
  /** Clears one field's filter; the label names the field for screen readers. */
  /** A mark right after a field's name (owner, 2026-11-05: an icon, not a word); the label names it. */
  clearField: "×",
  clearFieldLabel: (label: string): string => `Wyczyść: ${label}`,
  removeFilter: (label: string): string => `Usuń filtr: ${label}`,
  activeFilters: "Aktywne filtry",
  activeFiltersCount: (value: number): string => `Aktywne filtry (${String(value)})`,
  removeMark: "×",
  sortMark: { ascending: "▲", descending: "▼" },
  rowMetaSeparator: " · ",
  /** The same at the start of a part of the phone row's line, where an ordinary space would collapse. */
  rowMetaPartSeparator: `${NBSP}·${NBSP}`,
  shortlistedMark: "★",
  shortlisted: pl`na liście życzeń w grze`,
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
  },
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
    peakNote: (potential: number, peak: number): string =>
      pl`Szczyt OVR to prognoza z krzywych rozwoju gry, ta sama co na jej wykresie rozwoju; nie obejmuje przyszłych przyrostów z meczów i treningu.${peak < potential ? pl` Potencjału ${formatNumber(potential)} zawodnik według niej nie osiągnie.` : ""}`,
    overallByGroup: "OVR na pozycjach",
    openMark: "▾",
    closedMark: "▸",
    positionWithName: (name: string, abbreviation: string): string => `${name} (${abbreviation})`,
    /** The gain over the OVR before a rating, in brackets, with the space before the rating. */
    gain: (value: number): string => `(${signed(value)}) `,
    foot: "Lepsza noga",
    weakFoot: "Słabsza noga",
    starsOutOfFive: (stars: number): string => `${formatNumber(stars)} z 5 gwiazdek`,
    profile: "Profil",
    /** The line under a group's name; the range with an en dash. */
    groupSummary: (average: number, min: number, max: number, spread: number): string =>
      pl`Średnia ${formatRating(average)}, zakres ${formatNumber(min)}–${formatNumber(max)} (rozrzut ${formatNumber(spread)})`,
    unevenProfile: "Nierówny profil",
    internationalReputation: "Reputacja międzynarodowa",
    learningSpeed: "Szybkość nauki",
    yes: "tak",
    no: "nie",
    left: "lewa",
    right: "prawa",
    height: "Wzrost",
    weight: "Waga",
    heightValue: (cm: number): string => `${formatNumber(cm)}${NBSP}cm`,
    weightValue: (kg: number): string => `${formatNumber(kg)}${NBSP}kg`,
    career: pl`W tym sezonie kariery`,
    careerNote: pl`Gra prowadzi statystyki w lidze twojego klubu, w krajowym pucharze i w europejskich pucharach, dla każdego klubu tych rozgrywek. U zawodnika z innej ligi to tylko mecze w europejskich pucharach i z nich średnia ocena. U zawodnika, który odszedł z twojej ligi, to liczby z czasu gry w niej. KR to nagłówek kolumny średniej oceny na ekranie statystyk zawodnika w grze.`,
    form: "Średnia ocena (KR)",
    loanedFrom: "Wypożyczony z",
    morale: "Morale",
    price: "Cena",
    wage: "Zarobki rynkowe",
    contractWage: pl`Zarobki z kontraktu`,
    shortlisted: pl`Na twojej liście życzeń w grze`,
    wageNote: `Na mecz, wzorem gry. Po wygaśnięciu kontraktu gra może doliczyć 30% (wolny transfer).`,
    money: (amount: number, currency: CurrencyCode): string =>
      `${formatNumber(amount)}${NBSP}${CURRENCY_SYMBOLS[currency]}`,
    wageEstimate: (low: number, high: number, currency: CurrencyCode): string =>
      `${low === high ? formatNumber(low) : `${formatNumber(low)}–${formatNumber(high)}`}${NBSP}${CURRENCY_SYMBOLS[currency]}${NBSP}(szacunek)`,
    none: "brak",
  },
} as const;
