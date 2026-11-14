import { describe, expect, it } from "vitest";
import { bestPeakFields, TIE_RULES } from "./best-peak.ts";
import type { TieRule } from "./best-peak.ts";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import type { Preferences, ScoutState } from "./scout-state.ts";
import { canResetSettings } from "./settings-reset.ts";
import { FOUR_FOUR_TWO, TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

/** The profile after a transfer alone. */
const SIGNING = { afterSigning: true, atPeak: false } as const;

const PREFERRED_FIRST: readonly TieRule[] = [
  "preferredPosition",
  "formation",
  "weakFootCentre",
  "betterFootSide",
];

/** A right-footed striker whose peak ties at every forward code, his best peak as the load brings it. */
const striker = () => {
  const player = {
    ...testPlayer({ positionCode: 30 }),
    peakByCode: Array.from({ length: 32 }, (_, code) => (code >= 26 ? 80 : 60)),
  };
  return { ...player, ...bestPeakFields(player, FOUR_FOUR_TWO) };
};

const loaded = (state: ScoutState): ScoutState =>
  scoutReducer(scoutReducer(state, { type: "load-started", requestId: 1 }), {
    type: "load-succeeded",
    requestId: 1,
    players: [striker()],
    myTeamId: 10,
    career: { ...TEST_CAREER, formationCodes: FOUR_FOUR_TWO },
    curves: new Map(),
    languages: {},
    attachedLanguage: null,
  });

const chosen = (state: ScoutState, order: readonly TieRule[]): ScoutState =>
  scoutReducer(state, { type: "tie-order-chosen", order });

const bestCode = (state: ScoutState): number | null | undefined => state.players?.[0]?.bestPeakCode;

const restored = (state: ScoutState, tieOrder: readonly TieRule[]): ScoutState => {
  const preferences: Preferences = { filters: {}, sort: state.sort, showPotential: true, tieOrder };
  return scoutReducer(state, { type: "preferences-restored", preferences });
};

describe("the user's order of the best peak tie rules", () => {
  it("breaks the ties of the loaded players again when the order changes", () => {
    const state = loaded(initialScoutState);
    expect(bestCode(state)).toBe(29);
    const reordered = chosen(state, PREFERRED_FIRST);
    expect(reordered.tieOrder).toEqual(PREFERRED_FIRST);
    expect(reordered.players?.[0]).toMatchObject({ bestPeakCode: 30, bestPeakName: "ST" });
    const back = chosen(reordered, TIE_RULES);
    expect(back.tieOrder).toBeUndefined();
    expect(bestCode(back)).toBe(29);
  });

  it("applies a chosen order to players loaded later, and stored preferences to loaded ones", () => {
    expect(bestCode(loaded(chosen(initialScoutState, PREFERRED_FIRST)))).toBe(30);
    expect(bestCode(restored(loaded(initialScoutState), PREFERRED_FIRST))).toBe(30);
    expect(bestCode(restored(loaded(initialScoutState), TIE_RULES))).toBe(29);
  });

  it("is a view setting like the columns: no undo step, and back to the default on Resetuj", () => {
    const reordered = chosen(loaded(initialScoutState), PREFERRED_FIRST);
    expect(reordered.undo).toEqual([]);
    expect(canResetSettings(reordered)).toBe(true);
    const reset = scoutReducer(reordered, { type: "settings-reset" });
    expect(reset.tieOrder).toBeUndefined();
    expect(bestCode(reset)).toBe(29);
    expect(canResetSettings(reset)).toBe(false);
    // Clearing the filters alone keeps it.
    expect(scoutReducer(reordered, { type: "filters-reset" }).tieOrder).toEqual(PREFERRED_FIRST);
  });
});

/** The best peak position of the list after signing's player, once built. */
const signedCode = ({ signed }: ScoutState): number | null | undefined =>
  typeof signed === "object" ? signed[0]?.bestPeakCode : undefined;

describe("the tie order on the list after signing", () => {
  it("breaks its ties in the chosen order, and again in the default one", () => {
    const requested = scoutReducer(
      scoutReducer(loaded(initialScoutState), { type: "after-signing-shown", shown: true }),
      { type: "signed-requested", mode: SIGNING },
    );
    const built = scoutReducer(requested, {
      type: "signed-built",
      players: [striker()],
      mode: SIGNING,
    });
    expect(signedCode(built)).toBe(29);
    const reordered = chosen(built, PREFERRED_FIRST);
    expect(signedCode(reordered)).toBe(30);
    expect(signedCode(chosen(reordered, TIE_RULES))).toBe(29);
  });
});
