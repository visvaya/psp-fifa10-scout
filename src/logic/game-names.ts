// Club, league and country names in a language of the game (from its locale files), applied over the
// English fifa.db names; any name the game does not have keeps the fifa.db one.
import { countryKey, leagueKey, teamKey } from "../data/game-locale.ts";
import { nameCollator } from "./players.ts";
import type { Player } from "./players.ts";

/** Names by id; plain records so they store and post as they are. */
export interface GameNames {
  readonly teams: Readonly<Record<number, string>>;
  readonly leagues: Readonly<Record<number, string>>;
  readonly countries: Readonly<Record<number, string>>;
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

/** The game's names for the given ids; a league shows its sponsor name with its country if the game has one. */
export const gameNamesOf = (table: ReadonlyMap<number, string>, ids: NameIds): GameNames => ({
  teams: named(ids.teams, (id) => table.get(teamKey(id, 0))),
  leagues: named(ids.leagues, (id) => {
    const [name, country] = [table.get(leagueKey(id, 0)), table.get(leagueKey(id, 3))];
    return name === undefined || country === undefined ? name : `${name} (${country})`;
  }),
  countries: named(ids.countries, (id) => table.get(countryKey(id))),
});

const nameOr = (
  names: Readonly<Record<number, string>>,
  id: number | null,
  fallback: string | null,
): string | null => (id === null ? fallback : (names[id] ?? fallback));

/** The players with the game's names; the same array without names. */
export const localizePlayers = (
  players: readonly Player[],
  names: GameNames | null,
): readonly Player[] =>
  names === null
    ? players
    : players.map((player) => ({
        ...player,
        clubName: nameOr(names.teams, player.clubId, player.clubName),
        leagueName: nameOr(names.leagues, player.leagueId, player.leagueName),
        nationalTeamName: nameOr(names.teams, player.nationalTeamId, player.nationalTeamName),
        nationalityName: nameOr(names.countries, player.nationalityId, player.nationalityName),
      }));

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

/** Text order for a language; the fifa.db names and unknown languages keep the Polish order. */
export const collatorFor = (code: string | null): Intl.Collator => {
  const locale = code === null ? undefined : LANGUAGES[code]?.locale;
  return locale === undefined ? nameCollator : new Intl.Collator(locale);
};
