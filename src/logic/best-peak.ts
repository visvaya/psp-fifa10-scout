// The position where a player's peak OVR is highest: the largest of the peaks counted for each position
// code. It need not be the position he plays best today.
import { SCOUT_CONFIG } from "./config.ts";
import { positionOf, ratingCodeOf, sideOf } from "./positions.ts";

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
const codesAtPeak = (peakByCode: readonly number[], peak: number): readonly number[] =>
  peakByCode.flatMap((each, code) => (each === peak ? [code] : []));

/**
 * The other ways the game rates a position (rating choices, by their first code) that reach `peak`, in
 * code order, without the one `code` belongs to: its side variants rate the same way, so they add nothing.
 */
export const otherPeakChoices = (
  peakByCode: readonly number[],
  peak: number,
  code: number,
): readonly number[] => {
  const shown = ratingCodeOf(code);
  return [...new Set(codesAtPeak(peakByCode, peak).map(ratingCodeOf))].filter(
    (choice) => choice !== shown,
  );
};

/** The codes that pass `keep`, or all of them when none does. */
const narrowed = (codes: readonly number[], keep: (code: number) => boolean) => {
  const kept = codes.filter(keep);
  return kept.length > 0 ? kept : codes;
};

/**
 * The rules a tie goes by, in the default order (owner's rule, 2026-11-07): the positions of the user's
 * formation; with a weak foot of 4 or 5 stars, the central ones; those on the side of the better foot;
 * the preferred position. The user may reorder them; the first code in the game's order comes last.
 */
export const TIE_RULES = [
  "formation",
  "weakFootCentre",
  "betterFootSide",
  "preferredPosition",
] as const;

export type TieRule = (typeof TIE_RULES)[number];

/**
 * The codes each rule keeps, of a player in a formation, as steps that narrow one after another. The
 * better foot first drops the other side, so with nothing on the better foot's side the centre comes
 * before the other side (owner's rule, 2026-11-10).
 */
const KEEPS: Readonly<
  Record<
    TieRule,
    (player: PeakInput, formationCodes: readonly number[]) => readonly ((code: number) => boolean)[]
  >
> = {
  formation: (_player, formationCodes) => [(code) => formationCodes.includes(code)],
  weakFootCentre: (player) => [
    (code) => player.weakFoot >= SCOUT_CONFIG.centralWeakFootStarsMin && sideOf(code) === "central",
  ],
  betterFootSide: (player) => [
    (code) => sideOf(code) === player.preferredFoot || sideOf(code) === "central",
    (code) => sideOf(code) === player.preferredFoot,
  ],
  preferredPosition: (player) => [(code) => code === player.positionCode],
};

/**
 * An order of the rules from stored data: unknown and repeated entries dropped, missing rules added in
 * the default order.
 */
export const tieOrderOf = (value: unknown): readonly TieRule[] => {
  const known = (Array.isArray(value) ? value : []).filter((item: unknown): item is TieRule =>
    TIE_RULES.some((rule) => rule === item),
  );
  return [...new Set([...known, ...TIE_RULES])];
};

export const isDefaultOrder = (order: readonly TieRule[]): boolean =>
  order.every((rule, index) => rule === TIE_RULES[index]);

/** The order with `rule` moved one place up (-1) or down (1); unchanged at either end. */
export const movedRule = (
  order: readonly TieRule[],
  rule: TieRule,
  by: -1 | 1,
): readonly TieRule[] => {
  const from = order.indexOf(rule);
  const to = from + by;
  if (from < 0 || to < 0 || to >= order.length) return order;
  const moved = order.filter((each) => each !== rule);
  return [...moved.slice(0, to), rule, ...moved.slice(to)];
};

/**
 * The best peak with its position code and short name, and its gain over the OVR at that same position.
 * A tie goes by the rules in `order` (TIE_RULES), over the user's formation (its starting eleven's
 * codes) and the player's feet, then by the first code; all null without peaks (no career).
 */
export const bestPeakFields = (
  player: PeakInput,
  formationCodes: readonly number[],
  order: readonly TieRule[] = TIE_RULES,
) => {
  const { peakByCode, overallByCode } = player;
  if (peakByCode.length === 0) return NO_BEST_PEAK;
  const bestPeak = Math.max(...peakByCode);
  const code = Math.min(
    ...order
      .flatMap((rule) => KEEPS[rule](player, formationCodes))
      .reduce(narrowed, codesAtPeak(peakByCode, bestPeak)),
  );
  return {
    bestPeak,
    bestPeakCode: code,
    bestPeakName: positionOf(code).name,
    bestPeakGain: bestPeak - (overallByCode[code] ?? 0),
  };
};
