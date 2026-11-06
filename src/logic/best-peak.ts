// The position where a player's peak OVR is highest: the largest of the peaks counted for each position
// code. It need not be the position he plays best today.
import { positionOf } from "./positions.ts";

export const NO_BEST_PEAK = {
  bestPeak: null,
  bestPeakCode: null,
  bestPeakName: null,
  bestPeakGain: null,
};

/**
 * The best peak with its position code and short name, and its gain over the OVR at that same position.
 * A tie keeps the preferred position, then the first code; all null without peaks (no career).
 */
export const bestPeakFields = (
  peakByCode: readonly number[],
  overallByCode: readonly number[],
  preferredCode: number,
) => {
  if (peakByCode.length === 0) return NO_BEST_PEAK;
  const bestPeak = Math.max(...peakByCode);
  const code =
    peakByCode[preferredCode] === bestPeak ? preferredCode : peakByCode.indexOf(bestPeak);
  return {
    bestPeak,
    bestPeakCode: code,
    bestPeakName: positionOf(code).name,
    bestPeakGain: bestPeak - (overallByCode[code] ?? 0),
  };
};
