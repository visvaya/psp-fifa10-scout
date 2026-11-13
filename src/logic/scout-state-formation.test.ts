import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

const LISTS = { role: [1056], squadState: ["toSell"], target: [1056], peakTarget: [2080] } as const;

/** A finished load of a career whose formation has these codes. */
const loadCareer = (from: ScoutState, formationCodes: readonly number[]): ScoutState =>
  scoutReducer(scoutReducer(from, { type: "load-started", requestId: 1 }), {
    type: "load-succeeded",
    requestId: 1,
    players: [testPlayer()],
    myTeamId: 5,
    career: { ...TEST_CAREER, formationCodes },
    curves: new Map(),
    languages: {},
    attachedLanguage: null,
  });

/** The four lists set after a career of 0, 3, 5; the peak target needs the potential shown. */
const filtered = (): ScoutState =>
  scoutReducer(
    loadCareer(
      scoutReducer(initialScoutState, { type: "potential-shown", shown: true }),
      [0, 3, 5],
    ),
    { type: "filters-changed", filters: { text: "a", lists: LISTS } },
  );

describe("a load of another career save", () => {
  it("keeps the role and target filters under the same formation", () => {
    expect(loadCareer(filtered(), [0, 3, 5]).filters).toEqual({ text: "a", lists: LISTS });
  });

  it("drops the role and target filters, not the state, under another formation", () => {
    for (const codes of [
      [0, 3, 4],
      [0, 3],
    ]) {
      expect(loadCareer(filtered(), codes).filters).toEqual({
        text: "a",
        lists: { squadState: ["toSell"] },
      });
    }
  });
});
