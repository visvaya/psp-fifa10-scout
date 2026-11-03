/** Every text the user reads, in one module, with the Polish number and plural helpers. */
import type { LoadErrorKind, LoadPhase } from "../logic/load-scout.ts";
import type { AttributeName } from "../logic/players.ts";
import type { PositionGroup } from "../logic/positions.ts";
import type { ClubStatus, FilterKey, ScoutError } from "../logic/scout-state.ts";

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

const count = (value: number, forms: PluralForms): string =>
  `${formatNumber(value)}${NBSP}${plural(value, forms)}`;

const PLAYERS = { one: "zawodnik", few: "zawodników", many: "zawodników" } as const;
const YEARS = { one: "rok", few: "lata", many: "lat" } as const;

// Label tables: plain data that only the literal-blind duplicate check sees as alike.
// jscpd:ignore-start
export const POSITION_GROUP_LABELS: Readonly<Record<PositionGroup, string>> = {
  goalkeeper: "Bramkarze",
  "full-backs": "Boczni obrońcy",
  "wing-backs": "Wahadłowi",
  "centre-backs": "Środkowi obrońcy",
  "defensive-midfield": "Defensywni pomocnicy",
  wide: "Skrzydłowi",
  "central-midfield": "Środkowi pomocnicy",
  "attacking-midfield": "Ofensywni pomocnicy",
  forwards: "Napastnicy",
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

export const FILTER_LABELS: Readonly<Record<FilterKey, string>> = {
  text: "Nazwisko",
  positionGroups: "Pozycje",
  age: "Wiek",
  potential: "Potencjał",
  attributeMin: "Atrybuty",
  leagueIds: "Liga",
  teamIds: "Klub",
  nationalityIds: "Narodowość",
  contractEndsBy: "Kontrakt",
  clubStatus: "Zawodnicy",
  excludeMyClub: "Bez mojego klubu",
};

// jscpd:ignore-end

export const CLUB_STATUS_LABELS: Readonly<Record<ClubStatus, string>> = {
  "with-club": "z klubem",
  all: "wszyscy, także bez klubu",
  "free-agents": "tylko bez klubu",
};

const PHASES: Readonly<Record<LoadPhase, string>> = {
  game: "Czytam plik gry…",
  save: "Czytam zapis…",
  players: "Przygotowuję listę…",
};

const ERRORS: Readonly<Record<LoadErrorKind | "missing-file", string>> = {
  "wrong-game": "To plik innej gry. Narzędzie obsługuje FIFA 10 na PSP (ULES01328).",
  "wrong-file": "To nie jest właściwy plik. Sprawdź, czy wybrano dobry plik.",
  damaged: "Plik jest uszkodzony albo niepełny. Skopiuj go jeszcze raz.",
  unexpected: "Nie udało się odczytać pliku. Spróbuj ponownie.",
  "missing-file": "Wybierz oba pliki naraz: DATA.BIN i PARAM.SFO.",
};

export const TEXT = {
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
  gameStored: "Baza gry jest zapamiętana. Wybierz plik ponownie tylko po zmianie gry.",
  saveStep: "2. Zapis kariery (opcjonalnie)",
  saveInput: "Wybierz DATA.BIN i PARAM.SFO",
  saveHelp:
    "Oba pliki są w folderze PSP/SAVEDATA/ULES01328… (iPhone: Pliki, folder PPSSPP). Zaznacz je razem.",
  saveLoaded: "Zapis kariery wczytany.",
  phase: (phase: LoadPhase): string => PHASES[phase],
  error: (error: ScoutError): string =>
    `${error.stage === "game" ? "Plik gry" : "Zapis kariery"}: ${ERRORS[error.kind]}`,
  resultCount: (value: number): string => count(value, PLAYERS),
  noData: "Nie wczytano jeszcze bazy gry.",
  noMatches: "Żaden zawodnik nie spełnia filtrów.",
  filters: "Filtry",
  filtersWithCount: (value: number): string =>
    value === 0 ? "Filtry" : `Filtry (${String(value)})`,
  resetFilters: "Wyczyść filtry",
  removeFilter: (label: string): string => `Usuń filtr: ${label}`,
  activeFilters: "Aktywne filtry",
  removeMark: "×",
  sortMark: { ascending: "▲", descending: "▼" },
  rowMeta: (club: string, position: string, age: string): string =>
    `${club} · ${position} · ${age}`,
  anyOption: "Dowolna",
  anyClub: "Dowolny",
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
    potential: "Potencjał",
  },
  potentialShort: "POT",
  noClub: "bez klubu",
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
    foot: "Lepsza noga",
    left: "lewa",
    right: "prawa",
    height: "Wzrost",
    weight: "Waga",
    heightValue: (cm: number): string => `${formatNumber(cm)}${NBSP}cm`,
    weightValue: (kg: number): string => `${formatNumber(kg)}${NBSP}kg`,
    career: "W tym sezonie kariery",
    form: "Forma",
    morale: "Morale",
    goals: "Gole",
    appearances: "Występy",
    none: "brak",
  },
} as const;
