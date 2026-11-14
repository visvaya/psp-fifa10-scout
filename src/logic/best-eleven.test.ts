import { describe, expect, it } from "vitest";
import {
  assignRows,
  bestEleven,
  chosenFormation,
  fitOf,
  formationName,
  rankFormations,
} from "./best-eleven.ts";
import type { SquadMember } from "./best-eleven.ts";

/** A player with `value` at every code but those in `at`, no slot suiting him better. */
const member = (
  id: number,
  value: number,
  at: Readonly<Record<number, number>> = {},
): SquadMember => ({
  id,
  valueAt: (code) => at[code] ?? value,
  fitAt: () => 0,
});

/** A player with `value` at every code, suited by fitOf to his position and foot. */
const fitted = (
  value: number,
  player: { readonly positionCode: number; readonly preferredFoot: "left" | "right" },
) => ({ valueAt: () => value, fitAt: fitOf(player) });

describe("assignRows", () => {
  it("gives each row a distinct column with the highest total", () => {
    // Greedy row by row would give row 0 column 0 (9) and row 1 column 1 (1): 10. The best is 8 + 7.
    expect(
      assignRows([
        [9, 8],
        [7, 1],
      ]),
    ).toEqual([1, 0]);
  });

  it("leaves columns over when there are more than rows", () => {
    expect(assignRows([[1, 5, 3]])).toEqual([1]);
  });

  it("assigns every row of a larger square", () => {
    const weights = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const columns = assignRows(weights);
    expect(columns.toSorted((a, b) => a - b)).toEqual([0, 1, 2]);
    // Row 0 to column 0, row 1 to column 2, row 2 to column 1: 4 + 5 + 2, the highest of the six.
    expect(columns.reduce((sum, column, row) => sum + (weights[row]?.[column] ?? 0), 0)).toBe(11);
  });
});

/** A deterministic sequence of whole numbers 0..99 (a linear congruential generator). */
const numbers = (seed: number) => {
  let state = seed;
  return (): number => {
    state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
    return state % 100;
  };
};

/** The highest total of `weights` over every way to give each row a distinct column. */
const bruteForce = (
  weights: readonly (readonly number[])[],
  row = 0,
  taken = new Set<number>(),
): number => {
  const columns = weights[0]?.length ?? 0;
  if (row === weights.length) return 0;
  const totals = Array.from({ length: columns }, (_, column) => column)
    .filter((column) => !taken.has(column))
    .map(
      (column) =>
        (weights[row]?.[column] ?? 0) + bruteForce(weights, row + 1, new Set([...taken, column])),
    );
  return Math.max(...totals);
};

describe("assignRows against every assignment", () => {
  it("finds the highest total on random tables of up to 4 rows and 6 columns", () => {
    const next = numbers(7);
    const tables = Array.from({ length: 60 }, (_, index) => {
      const rows = 1 + (index % 4);
      const columns = rows + (index % 3);
      return Array.from({ length: rows }, () => Array.from({ length: columns }, next));
    });
    const found = tables.map((weights) =>
      assignRows(weights).reduce((sum, column, row) => sum + (weights[row]?.[column] ?? 0), 0),
    );
    expect(found).toEqual(tables.map((weights) => bruteForce(weights)));
  });
});

describe("bestEleven", () => {
  it("puts each player where the formation needs him most, by his value at each code", () => {
    // A goalkeeper (code 0) and two outfield players, for a formation of GK, CB (5) and ST (30).
    const squad = [
      member(1, 10, { 0: 80 }),
      member(2, 60, { 5: 75, 30: 70 }),
      member(3, 50, { 30: 72, 5: 74 }),
    ];
    const eleven = bestEleven(squad, [0, 5, 30]);
    // 75 + 72 = 147 beats 74 + 70 = 144.
    expect(eleven.slots).toEqual([
      { code: 0, playerId: 1, value: 80 },
      { code: 5, playerId: 2, value: 75 },
      { code: 30, playerId: 3, value: 72 },
    ]);
    expect(eleven.average).toBeCloseTo((80 + 75 + 72) / 3);
  });

  // The audit of roadmap 119 on a real career: a right back went to the left wing-back slot, as both
  // wing-back codes rate alike.
  it("breaks a tie by the preferred position, then by the side of the better foot", () => {
    const right = { id: 1, ...fitted(70, { positionCode: 3, preferredFoot: "right" }) };
    const left = { id: 2, ...fitted(70, { positionCode: 17, preferredFoot: "left" }) };
    // Wing-backs: 2 is on the right, 8 on the left.
    expect(bestEleven([right, left], [8, 2]).slots.map((slot) => slot.playerId)).toEqual([2, 1]);
    const back = { id: 3, ...fitted(70, { positionCode: 5, preferredFoot: "left" }) };
    // At his preferred centre-back code, though his foot is the left one.
    expect(bestEleven([left, back], [5, 17]).slots.map((slot) => slot.playerId)).toEqual([3, 2]);
  });

  it("never lets the fit outweigh a point of value", () => {
    const natural = { id: 1, ...fitted(70, { positionCode: 5, preferredFoot: "right" }) };
    const better = { id: 2, valueAt: (code: number) => (code === 5 ? 71 : 60), fitAt: () => 0 };
    expect(bestEleven([natural, better], [5, 30]).slots[0]?.playerId).toBe(2);
  });

  it("leaves slots empty without enough players, counting them as 0", () => {
    const eleven = bestEleven([member(1, 70)], [0, 5]);
    expect(eleven.slots.map((slot) => slot.playerId)).toContain(null);
    expect(eleven.average).toBe(35);
  });
});

describe("formationName", () => {
  it("counts the players of each line from the defence up, the goalkeeper aside", () => {
    expect(formationName([0, 3, 4, 6, 7, 15, 16, 18, 19, 29, 31])).toBe("4-4-2");
    // A diamond: one defensive midfielder, two wide, one attacking.
    expect(formationName([0, 3, 4, 6, 7, 11, 15, 19, 23, 29, 31])).toBe("4-1-2-1-2");
    expect(formationName([0, 4, 5, 6, 9, 13, 15, 19, 23, 29, 31])).toBe("3-2-2-1-2");
  });
});

describe("chosenFormation", () => {
  // CodeRabbit on #200: a choice kept as a place in the ranking moved to another formation when the
  // peak values reordered them.
  it("finds the chosen formation by its codes wherever it ranks, else the best one", () => {
    const squad = [member(1, 10, { 0: 80 }), member(2, 60, { 5: 75 }), member(3, 50, { 30: 72 })];
    const ranked = rankFormations(
      squad,
      [
        [0, 5, 5],
        [0, 5, 30],
      ],
      [],
    );
    expect(chosenFormation(ranked, [0, 5, 5])?.codes).toEqual([0, 5, 5]);
    expect(chosenFormation(ranked, null)?.codes).toEqual([0, 5, 30]);
    expect(chosenFormation(ranked, [0, 3, 3])?.codes).toEqual([0, 5, 30]);
    expect(chosenFormation([], null)).toBeUndefined();
  });
});

describe("rankFormations", () => {
  it("ranks the formations by their best eleven's average, marking the current one", () => {
    const squad = [member(1, 10, { 0: 80 }), member(2, 60, { 5: 75 }), member(3, 50, { 30: 72 })];
    const ranked = rankFormations(
      squad,
      [
        [0, 5, 5],
        [0, 5, 30],
      ],
      [0, 30, 5],
    );
    expect(ranked.map((formation) => formation.codes)).toEqual([
      [0, 5, 30],
      [0, 5, 5],
    ]);
    // The current one has the same codes in another order.
    expect(ranked.map((formation) => formation.current)).toEqual([true, false]);
  });
});
