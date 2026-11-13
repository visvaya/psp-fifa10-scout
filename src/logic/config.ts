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
  /** Seasons ahead the peak OVR projection looks: from 16 years old past the oldest curve age. */
  peakProjectionYears: 20,
  /**
   * Longest note on a player, in characters. No limit for the user (owner, 2026-11-07): this only bounds
   * a pathological paste, since every change stores all notes again.
   */
  noteMaxChars: 20_000,
  /** Weak foot stars from which a best peak tied across sides goes to the central code (owner, 2026-11-07). */
  centralWeakFootStarsMin: 4,
  /** A club player up to this age with at least developGainMinOvr to his peak is one to develop (roles.ts). */
  developAgeMaxYears: 21,
  developGainMinOvr: 5,
  /** A club player whose best role number is this or higher sits on the bench: to loan out or sell. */
  benchRoleNumberFrom: 3,
  /** A player outside the club gets a target only where he would be at most this number. */
  targetRoleNumberMax: 2,
  /** Changes of the filters, sort and sets the user can take back, newest first. */
  undoSteps: 50,
} as const;
