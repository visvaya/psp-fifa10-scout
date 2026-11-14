// The experience bar of the user's squad (roadmap 36; match-growth.md, section 4): the save's
// career_player_growth_xp holds each player's bar (level_up_xp, out of 1000) and his XP in 23
// attributes. At 1000 the bar levels up: it goes back to 0, and each attribute gains a point for every
// full 100 of its XP, unless his OVR has reached his potential.
import { careerList, careerManager, effectiveRows } from "../data/career-save.ts";
import type { CareerSave } from "../data/career-save.ts";
import { num } from "../data/ea-db.ts";
import type { EaDb, EaDbRow } from "../data/ea-db.ts";
import { SCOUT_CONFIG } from "./config.ts";

export interface LevelUpFields {
  /** The bar, 0 to 1000 (a return from the national team can push it past); null outside the squad. */
  readonly levelUpXp: number | null;
  /** The attribute points the next level-up gives; null outside the squad. */
  readonly levelUpPoints: number | null;
}

export const NO_LEVEL_UP: LevelUpFields = { levelUpXp: null, levelUpPoints: null };

const BAR_COLUMN = "level_up_xp";
const ATTRIBUTE_XP_SUFFIX = "_xp";
const XP_PER_POINT = 100;

/**
 * Each row's bar and points by player, of the players in `squad` only: the table keeps the rows of
 * players who left the squad for a while (match-growth.md, section 1).
 */
export const levelUpOf = (
  rows: readonly EaDbRow[],
  squad: ReadonlySet<number>,
): ReadonlyMap<number, LevelUpFields> =>
  new Map(
    rows
      .filter((row) => squad.has(num(row, "playerid")))
      .map((row) => [
        num(row, "playerid"),
        {
          levelUpXp: num(row, BAR_COLUMN),
          levelUpPoints: Object.keys(row)
            .filter((key) => key.endsWith(ATTRIBUTE_XP_SUFFIX) && key !== BAR_COLUMN)
            .reduce((sum, key) => sum + Math.max(0, Math.floor(num(row, key) / XP_PER_POINT)), 0),
        },
      ]),
  );

/** The fields as due: no points while his OVR has reached his potential, as the level-up gives none. */
export const dueLevelUp = (
  fields: LevelUpFields,
  overall: number,
  potential: number,
): LevelUpFields =>
  fields.levelUpPoints === null || overall < potential ? fields : { ...fields, levelUpPoints: 0 };

/**
 * The matches he plays before the bar is full, as a range: at the most and at the least XP a match
 * measured in the saves. Only a range: the XP of a match depends on his minutes, rating and potential.
 */
export const matchesToLevelUp = (levelUpXp: number): { fewest: number; most: number } => {
  const { levelUpBarXp, levelUpXpPerMatchLow, levelUpXpPerMatchHigh } = SCOUT_CONFIG;
  const left = Math.max(0, levelUpBarXp - levelUpXp);
  return {
    fewest: Math.ceil(left / levelUpXpPerMatchHigh),
    most: Math.ceil(left / levelUpXpPerMatchLow),
  };
};

/** The bar of each player linked to the user's club; none for anyone else. */
export const squadLevelUp = (db: EaDb, save: CareerSave): ((playerId: number) => LevelUpFields) => {
  const { teamId } = careerManager(db, save);
  const squad = effectiveRows(db, save, "teamplayerlinks")
    .filter((link) => num(link, "teamid") === teamId)
    .map((link) => num(link, "playerid"));
  const bars = levelUpOf(careerList(db, save, "career_player_growth_xp"), new Set(squad));
  return (playerId) => bars.get(playerId) ?? NO_LEVEL_UP;
};
