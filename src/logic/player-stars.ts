// A player's stars as the game shows them on its player screens ("Dane zawodnika"; EBOOT 0x089B5F64):
// his OVR against fixed thresholds, in half stars from 0.5 to 5.

/** Each OVR at or above one of these adds half a star to the first half. */
const PLAYER_STAR_THRESHOLDS = [55, 60, 65, 70, 75, 80, 85, 90, 95] as const;

export const playerStars = (overall: number): number =>
  (1 + PLAYER_STAR_THRESHOLDS.filter((threshold) => overall >= threshold).length) / 2;
