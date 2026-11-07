// Club, league, country and position names in a language of the game (from its locale files), applied
// over the English fifa.db names; any name the game does not have keeps the fifa.db one.
import { countryKey, labelKey, leagueKey, teamKey, textKey } from "../data/game-locale.ts";
import { NAME_LOCALE, nameCollator, withNameOrder } from "./players.ts";
import type { Player } from "./players.ts";
import { nameTextIdOf, POSITION_CODES, positionOf } from "./positions.ts";

/** Names by id; plain records so they store and post as they are. */
export interface GameNames {
  readonly teams: Readonly<Record<number, string>>;
  readonly leagues: Readonly<Record<number, string>>;
  readonly countries: Readonly<Record<number, string>>;
  /** Abbreviations by position code. */
  readonly positions: Readonly<Record<number, string>>;
  /** Full names by position code, for the codes the game names. */
  readonly positionNames: Readonly<Record<number, string>>;
}

/** The names of each language read so far, by its code (the .loc file stem, such as "pol_pl"). */
export type GameLanguages = Readonly<Record<string, GameNames>>;

export interface NameIds {
  readonly teams: readonly number[];
  readonly leagues: readonly number[];
  readonly countries: readonly number[];
}

/** The languages the UI names itself (the game does not name its languages); BCP 47 for collation. */
const LANGUAGES: Readonly<Record<string, { readonly label: string; readonly locale: string }>> = {
  pol_pl: { label: "Polski", locale: "pl" },
  eng_us: { label: "English", locale: "en" },
  cze_cz: { label: "Čeština", locale: "cs" },
  hun_hu: { label: "Magyar", locale: "hu" },
};

const named = (
  ids: readonly number[],
  name: (id: number) => string | undefined,
): Record<number, string> =>
  Object.fromEntries(
    ids.flatMap((id) => {
      const text = name(id);
      return text === undefined ? [] : [[id, text] as const];
    }),
  );

/**
 * The game's names for the given ids and every position; a league shows its sponsor name with its
 * country if the game has one.
 */
export const gameNamesOf = (table: ReadonlyMap<number, string>, ids: NameIds): GameNames => ({
  teams: named(ids.teams, (id) => table.get(teamKey(id, 0))),
  leagues: named(ids.leagues, (id) => {
    const [name, country] = [table.get(leagueKey(id, 0)), table.get(leagueKey(id, 3))];
    return name === undefined || country === undefined ? name : `${name} (${country})`;
  }),
  countries: named(ids.countries, (id) => table.get(countryKey(id))),
  positions: named(POSITION_CODES, (code) => table.get(labelKey(positionOf(code).name))),
  positionNames: named(POSITION_CODES, (code) => {
    const id = nameTextIdOf(code);
    return id === undefined ? undefined : table.get(textKey(id));
  }),
});

/** A position's abbreviation in the game language, else the game's English name. */
export const abbreviationIn = (names: GameNames | null, code: number): string =>
  names?.positions[code] ?? positionOf(code).name;

/**
 * A position's abbreviation in the game language, else the game's English name, for choosing a
 * position. The English name follows an abbreviation that could mean another position: one the
 * language gives two positions (Polish PN for RF and RS), or another position's English one (Polish ST
 * for the sweeper, English ST for the striker).
 */
export const positionNameIn = (names: GameNames | null, code: number): string => {
  const name = abbreviationIn(names, code);
  const confusing = POSITION_CODES.some(
    (other) =>
      other !== code && (abbreviationIn(names, other) === name || positionOf(other).name === name),
  );
  const english = positionOf(code).name;
  return confusing && name !== english ? `${name} (ang. ${english})` : name;
};

const nameOr = (
  names: Readonly<Record<number, string>>,
  id: number | null,
  fallback: string | null,
): string | null => (id === null ? fallback : (names[id] ?? fallback));

const renamed = (players: readonly Player[], names: GameNames | null): readonly Player[] =>
  names === null
    ? players
    : players.map((player) => ({
        ...player,
        clubName: nameOr(names.teams, player.clubId, player.clubName),
        leagueName: nameOr(names.leagues, player.leagueId, player.leagueName),
        nationalTeamName: nameOr(names.teams, player.nationalTeamId, player.nationalTeamName),
        loanedFromName: nameOr(names.teams, player.loanedFromId, player.loanedFromName),
        nationalityName: nameOr(names.countries, player.nationalityId, player.nationalityName),
        // The bare abbreviation, for the list's narrow position column (owner, 2026-11-04); the card and the
        // filters add the English name to a misleading one (positionNameIn).
        positionName: names.positions[player.positionCode] ?? player.positionName,
        bestPeakName:
          player.bestPeakCode === null
            ? null
            : (names.positions[player.bestPeakCode] ?? player.bestPeakName),
      }));

/**
 * The players with the game's names, their names ranked in the language's order; the same array when
 * neither changes anything.
 */
export const localizePlayers = (
  players: readonly Player[],
  names: GameNames | null,
  collator?: Intl.Collator,
): readonly Player[] => {
  const result = renamed(players, names);
  // The players come ranked in Polish order; the locale tells it without building the Polish collator.
  return collator === undefined || collator.resolvedOptions().locale === NAME_LOCALE
    ? result
    : withNameOrder(result, collator);
};

export const languageLabel = (code: string): string => LANGUAGES[code]?.label ?? code;

/** The game language matching the first browser language that has one, or null (fifa.db names). */
export const defaultLanguage = (
  codes: readonly string[],
  browserLanguages: readonly string[],
): string | null => {
  for (const browser of browserLanguages) {
    const [primary = ""] = browser.toLowerCase().split("-");
    const code = codes.find((candidate) => LANGUAGES[candidate]?.locale === primary);
    if (code !== undefined) return code;
  }
  return null;
};

/** The game language whose names show: the chosen one while known, else the browser's, else none. */
export const activeLanguage = (
  {
    gameLanguage,
    languages,
  }: { readonly gameLanguage?: string | null; readonly languages: GameLanguages },
  browserLanguages: readonly string[],
): string | null => {
  if (gameLanguage === undefined) return defaultLanguage(Object.keys(languages), browserLanguages);
  return gameLanguage !== null && Object.hasOwn(languages, gameLanguage) ? gameLanguage : null;
};

/** Text order for a language; the fifa.db names and unknown languages keep the Polish order. */
export const collatorFor = (code: string | null): Intl.Collator => {
  const locale = code === null ? undefined : LANGUAGES[code]?.locale;
  return locale === undefined ? nameCollator() : new Intl.Collator(locale);
};
