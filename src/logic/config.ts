export const SCOUT_CONFIG = {
  /** Ages without a career save are taken on this date (the game's first season starts in July 2009). */
  referenceDateIso: "2009-07-01",
  /** leagues.level below this marks a club league; 5 is International, 7 the World League. */
  clubLeagueLevelBelow: 5,
  /** leagues.level of the national teams' league. */
  nationalLeagueLevel: 5,
  /** Player ids from this one up form the generated youth pool. */
  youthPlayerIdStart: 400_000,
  /** Lowest value of each attribute colour band, as the game colours them; below average is low. */
  attributeBandMin: { high: 80, good: 70, average: 50 },
} as const;
