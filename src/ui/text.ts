/** Every text the user reads, in one module, with the Polish number and plural helpers. */
import type { CareerSummary, LoadErrorKind, LoadPhase, LoadStage } from "../logic/load-scout.ts";
import type { FlagKey, ListKey, RangeFields, RangeKey } from "../logic/filter-players.ts";
import { isAttributeName } from "../logic/players.ts";
import type { AttributeName } from "../logic/players.ts";
import type { PositionGroup } from "../logic/positions.ts";
import type { ClubStatus, MyClub, ScoutError } from "../logic/scout-state.ts";

const NBSP = " ";

export interface PluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
}

const pluralRules = new Intl.PluralRules("pl");
const numberFormat = new Intl.NumberFormat("pl-PL");

/** The Polish noun form for an integer count: 1 rok, 2–4 lata, 5–21 lat, 22–24 lata. */
export const plural = (count: number, forms: PluralForms): string => {
  const category = pluralRules.select(count);
  return category === "one" ? forms.one : category === "few" ? forms.few : forms.many;
};

export const formatNumber = (value: number): string => numberFormat.format(value);

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
  longshotaccuracy: "Strzały z dystansu",
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
  height: "Wzrost (cm)",
  weight: "Waga (kg)",
  weakFoot: "Słabsza noga (1–5)",
  internationalReputation: "Reputacja międzynarodowa (1–5)",
  learningSpeed: "Szybkość nauki (1–5)",
  retirementAge: "Wiek zakończenia kariery",
  clubRating: "Siła klubu",
  contractEndYear: "Kontrakt",
  form: "Forma",
  morale: "Morale",
  injuryDays: "Kontuzja (dni)",
  price: "Cena",
  wage: "Zarobki rynkowe (szacunek)",
};

export const rangeLabel = (key: RangeKey): string =>
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
  highclubidentification: "Silnie związany z klubem",
  hightrainingworkrate: "Pracowity na treningu",
  holdsup: "Utrzymuje piłkę",
  inflexible: "Mało elastyczny",
  latecrosser: "Późne dośrodkowania",
  leadership: "Lider",
  longshottaker: "Często strzela z dystansu",
  longthrows: "Długie wrzuty z autu",
  lowclubidentification: "Słabo związany z klubem",
  lowconcentration: "Słaba koncentracja",
  lowtrainingworkrate: "Mało pracowity na treningu",
  mediadarling: "Ulubieniec mediów",
  onetimepasser: "Gra na jeden kontakt",
  playmaker: "Rozgrywający",
  puncher: "Piąstkuje",
  pushesupforcorners: "Idzie pod bramkę przy rożnych",
  rushesoutofgoal: "Wychodzi z bramki",
  scandalprone: "Skłonny do skandali",
  selfish: "Samolubny",
  staysongoalline: "Zostaje na linii",
  technicaldribbler: "Drybler techniczny",
  nationalTeam: "Reprezentant kraju",
  transferListed: "Na liście transferowej",
};

export const FILTER_SECTION_LABELS = {
  basic: "Podstawowe",
  physique: "Sylwetka",
  attributes: "Atrybuty",
  traits: "Cechy",
  character: "Charakter i renoma",
  club: "Klub i kontrakt",
  career: "Kariera",
} as const;

// jscpd:ignore-end

export const MY_CLUB_LABELS: Readonly<Record<"all" | MyClub, string>> = {
  all: "wszyscy zawodnicy",
  hide: "ukryj zawodników mojego klubu",
  only: "tylko zawodnicy mojego klubu",
};

export const CLUB_STATUS_LABELS: Readonly<Record<ClubStatus, string>> = {
  available: "do sprowadzenia (z klubem i wolni)",
  "free-agents": "tylko wolni zawodnicy",
};

const PHASES: Readonly<Record<LoadPhase, string>> = {
  game: "Czytam plik gry…",
  save: "Czytam zapis…",
  players: "Przygotowuję listę…",
};

const ERRORS: Readonly<Record<LoadErrorKind | "missing-file", string>> = {
  "wrong-game": "To plik innej gry. Narzędzie obsługuje FIFA 10 na PSP (ULES01328).",
  "wrong-file": "To nie jest właściwy plik. Sprawdź, czy wybrano dobry plik.",
  "not-career":
    "To zapis profilu albo składów, nie kariery. Wybierz pliki z folderu kariery, zwykle ULES01328081.",
  damaged: "Plik jest uszkodzony albo niepełny. Skopiuj go jeszcze raz.",
  unexpected: "Nie udało się odczytać pliku. Spróbuj ponownie.",
  "missing-file": "Wybierz oba pliki naraz: DATA.BIN i PARAM.SFO.",
};

const STAGES: Readonly<Record<LoadStage, string>> = {
  game: "Plik gry",
  save: "Zapis kariery",
  locale: "Plik języka",
};

const LOCALE_MISSING = "Wybierz oba pliki naraz: plik .loc i string.idx z tego samego folderu.";

export const TEXT = {
  traitsNote:
    "Cechy pochodzą z bazy gry. Czy wpływają na rozgrywkę w wersji PSP, nie jest potwierdzone.",
  appTitle: "PSP FIFA 10 Scout",
  showFiles: "Pliki",
  showList: "Lista zawodników",
  startHeading: "Wczytaj pliki",
  startIntro: "Pliki zostają na tym urządzeniu. Nic nie jest wysyłane.",
  gameStep: "1. Plik gry",
  gameInput: "Wybierz obraz ISO lub fifa.db",
  gameHelpPhone:
    "iPhone: w aplikacji Pliki otwórz folder PPSSPP, potem PSP/GAME, i wybierz obraz ISO gry.",
  gameHelpPc: "PC: obraz ISO leży tam, gdzie trzymasz gry dla PPSSPP.",
  gameStored: "Wybierz plik ponownie tylko po zmianie gry.",
  gameLoaded: (name: string | null): string =>
    name === null ? "Zapamiętana baza gry" : `Wczytano: ${name}`,
  showPlayers: (value: number): string => `Pokaż zawodników (${String(value)})`,
  preparing: "Przygotowuję aplikację…",
  saveStep: "2. Zapis kariery (opcjonalnie)",
  saveInput: "Wybierz DATA.BIN i PARAM.SFO",
  saveHelp:
    "Zapis kariery jest zwykle w folderze PSP/SAVEDATA/ULES01328081 (iPhone: Pliki, folder PPSSPP). Zaznacz razem DATA.BIN i PARAM.SFO. Zapis zostaje na tym urządzeniu do usunięcia albo wyboru innego.",
  saveFolders:
    "DATA.BIN kariery ma około 540 KB. Foldery kończące się na 001 (profil, około 36 KB) i 021 (składy, około 270 KB) to inne zapisy.",
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
  languageStep: "3. Język nazw",
  languageSelect: "Nazwy klubów, lig i krajów",
  languageFromDb: "Angielskie z bazy fifa.db",
  languageHelp:
    "Obraz ISO zawiera nazwy we wszystkich językach gry; po jego wczytaniu wybierz język z listy.",
  localeInput: "Albo dołącz plik języka i string.idx",
  localeHelp:
    "Pliki leżą w obrazie ISO w PSP_GAME/USRDIR/data/gui/locale, np. pol_pl.loc. Zaznacz plik języka razem ze string.idx z tego samego folderu.",
  resultCount: (value: number): string => count(value, PLAYERS),
  installHeading: "Aplikacja na ekranie początkowym",
  installHelp:
    "Po pierwszym otwarciu narzędzie działa też bez internetu. iPhone: w Safari wybierz Udostępnij, potem Do ekranu początkowego. Chrome i Edge: menu przeglądarki, potem Zainstaluj aplikację.",
  update: {
    waiting: "Dostępna jest nowa wersja.",
    installing: "Instalowanie nowej wersji…",
    outdated: "Nowa wersja została zainstalowana w innym oknie.",
    failed: "Nie udało się pobrać nowej wersji. Spróbuj później.",
    reload: "Odśwież",
  },
  noData: "Nie wczytano jeszcze bazy gry.",
  noMatches: "Żaden zawodnik nie spełnia filtrów.",
  filters: "Filtry",
  showPotential: "Pokaż potencjał",
  positionRating: "Ocena na pozycji",
  position: "Pozycja",
  ratingAt: (position: string): string => `OVR ${position}`,
  ratingChoice: (group: string, abbreviation: string): string => `${group} (${abbreviation})`,
  /** Group labels joined, the later ones in lower case: "Boczny pomocnik / skrzydłowy". */
  groupList: (labels: readonly string[]): string =>
    labels.map((label, index) => (index === 0 ? label : label.toLocaleLowerCase("pl"))).join(" / "),
  ratingGain: "Różnica do OVR",
  gainAt: (position: string): string => `Różnica ${position}`,
  signed: (value: number): string => signed(value),
  text: "Nazwisko",
  clubStatus: "Zawodnicy",
  myClub: "Mój klub",
  addAttribute: "Dodaj atrybut",
  chooseAttribute: "Wybierz atrybut",
  removeAttribute: (label: string): string => `Usuń atrybut: ${label}`,
  searchIn: (label: string): string => `Szukaj: ${label}`,
  flagValues: { any: "obojętne", yes: "tak", no: "nie" },
  flagChip: (label: string, wanted: boolean): string => `${label}: ${wanted ? "tak" : "nie"}`,
  code: (prefix: string, value: number): string => `${prefix} ${String(value)}`,
  codePrefix: { bodyType: "typ", developmentType: "typ", developmentStyle: "styl" },
  filtersWithCount: (value: number): string =>
    value === 0 ? "Filtry" : `Filtry (${String(value)})`,
  resetFilters: "Wyczyść filtry",
  removeFilter: (label: string): string => `Usuń filtr: ${label}`,
  activeFilters: "Aktywne filtry",
  activeFiltersCount: (value: number): string => `Aktywne filtry (${String(value)})`,
  removeMark: "×",
  sortMark: { ascending: "▲", descending: "▼" },
  rowMetaSeparator: " · ",
  anyOption: "Dowolna",
  min: "od",
  max: "do",
  contractEndsBy: "Kontrakt kończy się najpóźniej w",
  sortBy: "Sortuj według",
  sortAscending: "rosnąco",
  sortDescending: "malejąco",
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
    overallByGroup: "OVR na pozycjach",
    openMark: "▾",
    closedMark: "▸",
    positionWithName: (name: string, abbreviation: string): string => `${name} (${abbreviation})`,
    /** The gain over the OVR after a rating, empty at no gain. */
    gain: (value: number): string => (value === 0 ? "" : ` (${signed(value)})`),
    foot: "Lepsza noga",
    left: "lewa",
    right: "prawa",
    height: "Wzrost",
    weight: "Waga",
    heightValue: (cm: number): string => `${formatNumber(cm)}${NBSP}cm`,
    weightValue: (kg: number): string => `${formatNumber(kg)}${NBSP}kg`,
    career: "W tym sezonie kariery",
    careerNote:
      "Gra prowadzi te statystyki tylko w lidze twojego klubu. U zawodnika, który z niej odszedł, to archiwalne liczby z czasu gry w tej lidze.",
    form: "Forma",
    morale: "Morale",
    goals: "Gole",
    appearances: "Występy",
    price: "Cena",
    wage: "Zarobki rynkowe",
    wageNote: `Na mecz, wzorem gry. Po wygaśnięciu kontraktu gra może doliczyć 30${NBSP}% (wolny transfer).`,
    wageEstimate: (low: number, high: number): string =>
      `${low === high ? formatNumber(low) : `${formatNumber(low)}–${formatNumber(high)}`}${NBSP}(szacunek)`,
    none: "brak",
  },
} as const;
