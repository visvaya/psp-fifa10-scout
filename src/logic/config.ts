export const SCOUT_CONFIG = {
  /** Ages without a career save are taken on this date (the game's first season starts in July 2009). */
  referenceDateIso: "2009-07-01",
  /** leagues.level below this marks a club league; 5 is International, 7 the World League. */
  clubLeagueLevelBelow: 5,
  /** leagues.level of the national teams' league. */
  nationalLeagueLevel: 5,
  /** Player ids from this one up form the generated youth pool. */
  youthPlayerIdStart: 400_000,
  /** The team a career save links free agents to; it is in no teams row (game-knowledge, free agents). */
  freeAgentTeamId: 111_259,
  /** Lowest value of each attribute colour band, as the game colours them; below average is low. */
  attributeBandMin: { high: 80, good: 70, average: 50 },
  /**
   * Spread of a group (strongest minus weakest attribute) from which the card calls the profile uneven,
   * in attribute points: the 80th percentile (nearest rank) of the group's spreads in the fifa.db of the
   * game, measured 2026-11-05 among the 1305 goalkeepers for the goalkeeping group and among the 11 740
   * outfield players for the other five (13 045 players in all).
   */
  attributeGroupUnevenSpreadMin: {
    physical: 27,
    technique: 32,
    shooting: 33,
    mental: 20,
    defending: 8,
    goalkeeping: 13,
  },
  /** Seasons ahead the peak OVR projection looks: from 16 years old past the oldest curve age. */
  peakProjectionYears: 20,
  /** Longest note on a player of the own watchlist, in characters. */
  watchlistNoteMaxChars: 500,
  /** Changes of the filters, sort and sets the user can take back, newest first. */
  undoSteps: 50,
} as const;
