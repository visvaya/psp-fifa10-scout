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
