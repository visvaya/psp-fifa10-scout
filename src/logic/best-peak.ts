// The position where a player's peak OVR is highest: the largest of the peaks counted for each position
// code. It need not be the position he plays best today.
import { SCOUT_CONFIG } from "./config.ts";
import { positionOf, sideOf } from "./positions.ts";

export const NO_BEST_PEAK = {
  bestPeak: null,
  bestPeakCode: null,
  bestPeakName: null,
  bestPeakGain: null,
};

export type BestPeakKey = keyof typeof NO_BEST_PEAK;

/** What the best peak reads of a player: his peaks, and what decides between positions that tie. */
export interface PeakInput {
  readonly peakByCode: readonly number[];
  readonly overallByCode: readonly number[];
  /** The preferred position. */
  readonly positionCode: number;
  readonly preferredFoot: "left" | "right";
  /** Weak foot stars, 1..5. */
  readonly weakFoot: number;
}

/** The codes whose peak is `peak`, in code order. */
export const codesAtPeak = (peakByCode: readonly number[], peak: number): readonly number[] =>
  peakByCode.flatMap((each, code) => (each === peak ? [code] : []));

/** The codes that pass `keep`, or all of them when none does. */
const narrowed = (codes: readonly number[], keep: (code: number) => boolean) => {
  const kept = codes.filter(keep);
  return kept.length > 0 ? kept : codes;
};

/**
 * The code among tied ones (owner's rule, 2026-11-07): those in the user's formation, if any; then the
 * central ones with a weak foot of 4 or 5 stars, else those on the side of the better foot, if any;
 * then the preferred position if it remains, else the first code.
 */
const tiedCode = (
  tied: readonly number[],
  player: PeakInput,
  formationCodes: readonly number[],
): number => {
  const candidates = narrowed(tied, (code) => formationCodes.includes(code));
  const central = candidates.filter((code) => sideOf(code) === "central");
  const remaining =
    player.weakFoot >= SCOUT_CONFIG.centralWeakFootStarsMin && central.length > 0
      ? central
      : narrowed(candidates, (code) => sideOf(code) === player.preferredFoot);
  return remaining.includes(player.positionCode) ? player.positionCode : Math.min(...remaining);
};

/**
 * The best peak with its position code and short name, and its gain over the OVR at that same position.
 * A tie goes by the user's formation (its starting eleven's codes) and the player's feet; all null
 * without peaks (no career).
 */
export const bestPeakFields = (player: PeakInput, formationCodes: readonly number[]) => {
  const { peakByCode, overallByCode } = player;
  if (peakByCode.length === 0) return NO_BEST_PEAK;
  const bestPeak = Math.max(...peakByCode);
  const code = tiedCode(codesAtPeak(peakByCode, bestPeak), player, formationCodes);
  return {
    bestPeak,
    bestPeakCode: code,
    bestPeakName: positionOf(code).name,
    bestPeakGain: bestPeak - (overallByCode[code] ?? 0),
  };
};
