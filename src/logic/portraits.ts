// The names of the game's portraits of a player in its graphics: a real photo s_<playerid, 8 digits>
// where the game has one, else a face composed from parts of the players row.
import { num } from "../data/ea-db.ts";
import type { EaDbRow } from "../data/ea-db.ts";

const digits = (value: number, length: number): string => String(value).padStart(length, "0");

/** The real portrait's name. */
export const realPortraitOf = (playerId: number): string => `s_${digits(playerId, 8)}`;

/**
 * The composed portrait's name: g_ with facetypeid (3 digits), hairtypeid (2), facialhairstyleid (1)
 * and haircolorid (1), zero-padded.
 */
export const composedPortraitOf = (row: EaDbRow): string =>
  `g_${digits(num(row, "facetypeid"), 3)}${digits(num(row, "hairtypeid"), 2)}${digits(
    num(row, "facialhairstyleid"),
    1,
  )}${digits(num(row, "haircolorid"), 1)}`;

/** A part of a composed portrait's look that a nearby one may lack: the face itself always matches. */
export type LookPart = "hair" | "hairColor" | "facialHair";

/** Where each part sits in a composed portrait's name, by how much it counts when looking for the nearest. */
const LOOK_PARTS: readonly (readonly [LookPart, number, number, number])[] = [
  ["hair", 5, 7, 4],
  ["hairColor", 8, 9, 2],
  ["facialHair", 7, 8, 1],
];

/** The parts of the shown composed portrait's look that differ from the wanted one's. */
export const lookDifferences = (wanted: string, shown: string): readonly LookPart[] =>
  LOOK_PARTS.filter(([, from, to]) => wanted.slice(from, to) !== shown.slice(from, to)).map(
    ([part]) => part,
  );

const likeness = (wanted: string, name: string): number =>
  LOOK_PARTS.reduce(
    (sum, [, from, to, weight]) =>
      sum + (wanted.slice(from, to) === name.slice(from, to) ? weight : 0),
    0,
  );

/**
 * The composed portrait among the names nearest to the wanted one (owner, 2026-11-13): the same face
 * (facetypeid, the skin with it), then the same hair, hair colour and facial hair in that priority, a tie
 * to the lowest name; null without the same face.
 */
export const nearestComposedPortrait = (wanted: string, names: readonly string[]): string | null =>
  names
    .filter((name) => name.startsWith(wanted.slice(0, 5)))
    .reduce<string | null>((best, name) => {
      if (best === null) return name;
      const [score, bestScore] = [likeness(wanted, name), likeness(wanted, best)];
      return score > bestScore || (score === bestScore && name < best) ? name : best;
    }, null);
