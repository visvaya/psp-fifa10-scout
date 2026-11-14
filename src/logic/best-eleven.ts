// The best starting eleven of each formation and the formations ranked by it (roadmap 98, owner
// 2026-11-11: "a formation that, by the players' OVR at each position, makes the most of the squad").
// Placing players in a formation's slots is an assignment problem: the highest total of values at the
// slots' codes, each player in one slot at most, solved exactly by the Hungarian algorithm.
import { sideOf } from "./positions.ts";

/** A squad player as the eleven reads him: his value (OVR, or his peak) at each position code. */
export interface SquadMember {
  readonly id: number;
  readonly valueAt: (code: number) => number;
  /**
   * How well a slot suits him beyond his value, 0 to MAX_FIT: breaks ties only, since mirrored codes
   * and whole position groups share one OVR (fitOf).
   */
  readonly fitAt: (code: number) => number;
}

/** The most fitAt gives; times eleven slots it stays under one point of value (TIE_SCALE). */
const MAX_FIT = 3;
const STARTING_ELEVEN = 11;
const TIE_SCALE = MAX_FIT * STARTING_ELEVEN + 1;

/**
 * A slot's fit for a player: 2 at his preferred position, 1 on the side of his better foot (the owner's
 * rules for a tied peak, roadmap 53), so a tie puts him where he plays.
 */
export const fitOf =
  (player: { readonly positionCode: number; readonly preferredFoot: "left" | "right" }) =>
  (code: number): number =>
    (code === player.positionCode ? 2 : 0) + (sideOf(code) === player.preferredFoot ? 1 : 0);

/** A slot of the formation with the player placed there; null when the squad has none left. */
interface ElevenSlot {
  readonly code: number;
  readonly playerId: number | null;
  readonly value: number;
}

export interface Eleven {
  readonly slots: readonly ElevenSlot[];
  /** The mean of the slots' values, an empty slot as 0. */
  readonly average: number;
}

export interface RankedFormation extends Eleven {
  readonly codes: readonly number[];
  readonly name: string;
  /** The same codes as the formation of the user's club in the save, in any order. */
  readonly current: boolean;
}

/** The Hungarian algorithm's state: potentials of rows and columns, and each column's row (1-based). */
interface Potentials {
  readonly rowPotential: number[];
  readonly columnPotential: number[];
  readonly rowOfColumn: number[];
}

/** An entry of a list the algorithm sizes itself, 0 when out of range. */
const at = (values: readonly number[], index: number): number => values[index] ?? 0;

/** One search step of addRow: the reach of every column from the rows already on the path. */
interface Search {
  readonly reach: number[];
  readonly previous: number[];
  readonly used: boolean[];
}

/**
 * Lowers the reach of the columns off the path through row `from`, and returns the nearest of them with
 * its distance.
 */
const nearestColumn = (
  cost: (row: number, column: number) => number,
  state: Potentials,
  search: Search,
  { from, column }: { readonly from: number; readonly column: number },
) => {
  const { reach, previous, used } = search;
  let nearest = { column: 0, delta: Infinity };
  for (let other = 1; other < reach.length; other += 1) {
    if (used[other] === true) continue;
    const reduced =
      cost(from, other) - at(state.rowPotential, from) - at(state.columnPotential, other);
    if (reduced < at(reach, other)) {
      reach[other] = reduced;
      previous[other] = column;
    }
    if (at(reach, other) < nearest.delta) nearest = { column: other, delta: at(reach, other) };
  }
  return nearest;
};

/** Moves the potentials by `delta`: the path's rows and columns, and the reach of the rest. */
const shiftPotentials = (state: Potentials, search: Search, delta: number) => {
  const { rowPotential, columnPotential, rowOfColumn } = state;
  const { used, reach } = search;
  used.forEach((onPath, column) => {
    if (onPath) {
      const owner = at(rowOfColumn, column);
      rowPotential[owner] = at(rowPotential, owner) + delta;
      columnPotential[column] = at(columnPotential, column) - delta;
    } else reach[column] = at(reach, column) - delta;
  });
};

/**
 * Adds row `row` (1-based) to the assignment along the cheapest augmenting path of `cost` (rows and
 * columns 1-based, column 0 a virtual one). Mutates only the state it is given, owned by assignRows.
 */
const addRow = (cost: (row: number, column: number) => number, state: Potentials, row: number) => {
  const { rowOfColumn } = state;
  const size = rowOfColumn.length;
  const search: Search = {
    reach: Array.from({ length: size }, () => Infinity),
    previous: Array.from({ length: size }, () => 0),
    used: Array.from({ length: size }, () => false),
  };
  rowOfColumn[0] = row;
  let column = 0;
  while (at(rowOfColumn, column) !== 0) {
    search.used[column] = true;
    const nearest = nearestColumn(cost, state, search, { from: at(rowOfColumn, column), column });
    shiftPotentials(state, search, nearest.delta);
    column = nearest.column;
  }
  while (column !== 0) {
    const back = at(search.previous, column);
    rowOfColumn[column] = at(rowOfColumn, back);
    column = back;
  }
};

/**
 * The column each row gets so that the rows' weights add up to the most, every column used once at most;
 * needs no more rows than columns.
 */
export const assignRows = (weights: readonly (readonly number[])[]): readonly number[] => {
  const rows = weights.length;
  const columns = weights[0]?.length ?? 0;
  const state: Potentials = {
    rowPotential: Array.from({ length: rows + 1 }, () => 0),
    columnPotential: Array.from({ length: columns + 1 }, () => 0),
    rowOfColumn: Array.from({ length: columns + 1 }, () => 0),
  };
  // The algorithm finds the least cost: the most weight is the least of its negation.
  const cost = (row: number, column: number): number => -(weights[row - 1]?.[column - 1] ?? 0);
  for (let row = 1; row <= rows; row += 1) addRow(cost, state, row);
  const assigned = Array.from({ length: rows }, () => -1);
  state.rowOfColumn.forEach((row, column) => {
    if (row > 0 && column > 0) assigned[row - 1] = column - 1;
  });
  return assigned;
};

/** The best eleven of a formation: each slot's player, so that their values add up to the most. */
export const bestEleven = (squad: readonly SquadMember[], codes: readonly number[]): Eleven => {
  // Without enough players, empty places worth 0 fill the columns up to the slots.
  const columns = Math.max(squad.length, codes.length);
  const weights = codes.map((code) =>
    Array.from({ length: columns }, (_, column) => {
      const player = squad[column];
      return player === undefined ? 0 : player.valueAt(code) * TIE_SCALE + player.fitAt(code);
    }),
  );
  const assigned = assignRows(weights);
  const slots = codes.map((code, row): ElevenSlot => {
    const player = squad[assigned[row] ?? -1];
    return player === undefined
      ? { code, playerId: null, value: 0 }
      : { code, playerId: player.id, value: player.valueAt(code) };
  });
  const total = slots.reduce((sum, slot) => sum + slot.value, 0);
  return { slots, average: codes.length === 0 ? 0 : total / codes.length };
};

/** The first code of each line from the defence up: defence, defensive midfield, midfield, attacking midfield, attack. */
const LINE_STARTS = [1, 9, 14, 21, 26] as const;

/** "4-4-2": the players of each line from the defence up, the goalkeeper aside, empty lines left out. */
export const formationName = (codes: readonly number[]): string =>
  LINE_STARTS.map((start, index) => {
    const end = LINE_STARTS[index + 1] ?? Infinity;
    return codes.filter((code) => code >= start && code < end).length;
  })
    .filter((count) => count > 0)
    .join("-");

const sameCodes = (one: readonly number[], other: readonly number[]): boolean =>
  one.toSorted((a, b) => a - b).join() === other.toSorted((a, b) => a - b).join();

/** The ranked formation with these codes, the best one while none is chosen or it is gone. */
export const chosenFormation = (
  ranked: readonly RankedFormation[],
  codes: readonly number[] | null,
): RankedFormation | undefined =>
  (codes === null
    ? undefined
    : ranked.find((formation) => formation.codes.join() === codes.join())) ?? ranked[0];

/** Each formation's best eleven, the highest average first; ties keep the formations' order. */
export const rankFormations = (
  squad: readonly SquadMember[],
  formations: readonly (readonly number[])[],
  currentCodes: readonly number[],
): readonly RankedFormation[] =>
  formations
    .map((codes) => ({
      codes,
      name: formationName(codes),
      current: sameCodes(codes, currentCodes),
      ...bestEleven(squad, codes),
    }))
    .toSorted((one, other) => other.average - one.average);
