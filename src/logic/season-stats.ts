// The season's counts in the save's stats row (playerstats): in the league, in the cups and in both.
import { num } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";

/**
 * Season counts from the save: league games, goals, assists and clean sheets (the game counts clean
 * sheets for goalkeepers only), each also over the domestic and European cups together (cup0..cup3). A
 * player outside the user's league has 0 in the league (docs: game-knowledge.md).
 */
export const SEASON_STAT_KEYS = [
  "totalAppearances",
  "totalGoals",
  "totalAssists",
  "totalCleanSheets",
  "appearances",
  "goals",
  "cupAppearances",
  "cupGoals",
  "assists",
  "cupAssists",
  "cleanSheets",
  "cupCleanSheets",
] as const;
export type SeasonStats = { readonly [K in (typeof SEASON_STAT_KEYS)[number]]: number | null };

/** A column of the save's stats row; null without the row or the column. */
export const statOf = (stats: EaDbRow | undefined, key: string): number | null =>
  stats?.[key] === undefined ? null : num(stats, key);

/** A stat summed over the four cup columns (cup0..cup3); a column the row lacks counts 0. */
const cupTotal = (stats: EaDbRow | undefined, key: string): number | null =>
  stats === undefined
    ? null
    : [0, 1, 2, 3].reduce((total, cup) => total + Number(stats[`${key}cup${String(cup)}`] ?? 0), 0);

/** A stat in the league and in the cups, and both together; null without the save's row. */
const leagueAndCups = (stats: EaDbRow | undefined, key: string) => {
  const league = statOf(stats, key);
  const cups = cupTotal(stats, key);
  return { league, cups, total: league === null || cups === null ? null : league + cups };
};

export const seasonStats = (stats: EaDbRow | undefined): SeasonStats => {
  const appearances = leagueAndCups(stats, "appearances");
  const goals = leagueAndCups(stats, "goals");
  const assists = leagueAndCups(stats, "assists");
  const cleanSheets = leagueAndCups(stats, "cleansheets");
  return {
    totalAppearances: appearances.total,
    totalGoals: goals.total,
    totalAssists: assists.total,
    totalCleanSheets: cleanSheets.total,
    appearances: appearances.league,
    goals: goals.league,
    cupAppearances: appearances.cups,
    cupGoals: goals.cups,
    assists: assists.league,
    cupAssists: assists.cups,
    cleanSheets: cleanSheets.league,
    cupCleanSheets: cleanSheets.cups,
  };
};
