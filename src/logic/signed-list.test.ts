import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { canResetSettings } from "./settings-reset.ts";
import { needsSignedList, shownPlayers } from "./signed-list.ts";
import { TEST_CAREER, testPlayer } from "./test-support/player-fixtures.ts";

const money = { price: 15_000_000, wage: 8700, priceEuro: 15_449_999.6, wageEuro: 8742.2 };
const BEFORE = testPlayer({ id: 1, potential: 80, ...money });
const AFTER = testPlayer({ id: 1, potential: 84, ...money });

const loaded = (from: ScoutState, requestId = 1): ScoutState =>
  scoutReducer(scoutReducer(from, { type: "load-started", requestId }), {
    type: "load-succeeded",
    requestId,
    players: [BEFORE],
    myTeamId: 5,
    career: TEST_CAREER,
    curves: new Map(),
    languages: {},
    attachedLanguage: null,
  });

const switched = (state: ScoutState, shown = true): ScoutState =>
  scoutReducer(state, { type: "after-signing-shown", shown });

const built = (state: ScoutState, players: readonly (typeof AFTER)[] | null = [AFTER]) =>
  scoutReducer(scoutReducer(state, { type: "signed-requested" }), {
    type: "signed-built",
    players,
  });

describe("the list after signing", () => {
  it("is asked for once the setting is on with a career loaded, and not again", () => {
    const career = loaded(initialScoutState);
    expect(needsSignedList(career)).toBe(false);
    const on = switched(career);
    expect(on.afterSigning).toBe(true);
    expect(needsSignedList(on)).toBe(true);
    expect(needsSignedList(scoutReducer(on, { type: "signed-requested" }))).toBe(false);
    // Without a career there is nothing to sign.
    expect(needsSignedList(switched(initialScoutState))).toBe(false);
  });

  it("shows the built list while the setting is on, and the players before signing otherwise", () => {
    const on = switched(loaded(initialScoutState));
    expect(shownPlayers(scoutReducer(on, { type: "signed-requested" }))).toEqual([BEFORE]);
    const ready = built(on);
    expect(shownPlayers(ready)?.map((player) => player.potential)).toEqual([84]);
    expect(shownPlayers(switched(ready, false))).toEqual([BEFORE]);
  });

  it("marks a list the worker could not build as failed, showing the players before signing", () => {
    const failed = built(switched(loaded(initialScoutState)), null);
    expect(failed.signed).toBe("failed");
    expect(shownPlayers(failed)).toEqual([BEFORE]);
  });

  it("fails a list still pending when the worker is gone, and keeps a built one through a failed load", () => {
    const failure = {
      type: "load-failed",
      requestId: 1,
      error: { stage: "game", kind: "unexpected" },
    } as const;
    const pending = scoutReducer(switched(loaded(initialScoutState)), { type: "signed-requested" });
    expect(scoutReducer(pending, failure).signed).toBe("failed");
    const ready = built(switched(loaded(initialScoutState)));
    expect(scoutReducer(ready, failure).signed).toBe(ready.signed);
  });

  it("keeps each player's money before signing: his value after a transfer is not counted", () => {
    const richer = testPlayer({ id: 1, potential: 84, price: 20_000_000, priceEuro: 20_000_000 });
    const ready = built(switched(loaded(initialScoutState)), [richer]);
    expect(shownPlayers(ready)?.map(({ potential, price }) => ({ potential, price }))).toEqual([
      { potential: 84, price: 15_000_000 },
    ]);
  });

  it("prices the built list in the shown currency, and again when it changes", () => {
    const pounds = scoutReducer(switched(loaded(initialScoutState)), {
      type: "currency-chosen",
      currency: 1,
    });
    const ready = built(pounds);
    expect(shownPlayers(ready)?.map((player) => player.price)).toEqual([13_000_000]);
    const dollars = scoutReducer(ready, { type: "currency-chosen", currency: 2 });
    expect(shownPlayers(dollars)?.map((player) => player.price)).toEqual([22_000_000]);
  });

  it("drops the list when another game or save loads, so it is asked for again", () => {
    const again = loaded(built(switched(loaded(initialScoutState))), 2);
    expect(again.signed).toBeUndefined();
    expect(needsSignedList(again)).toBe(true);
    // A late reply nothing waits for changes nothing.
    expect(scoutReducer(again, { type: "signed-built", players: [AFTER] })).toBe(again);
  });

  it("is turned off by Resetuj, which then has something to reset", () => {
    const on = switched(loaded(initialScoutState));
    expect(canResetSettings(on)).toBe(true);
    expect(scoutReducer(on, { type: "settings-reset" }).afterSigning).toBeUndefined();
  });

  it("is restored from the stored preferences", () => {
    const restored = scoutReducer(initialScoutState, {
      type: "preferences-restored",
      preferences: {
        filters: {},
        sort: initialScoutState.sort,
        showPotential: false,
        afterSigning: true,
      },
    });
    expect(restored.afterSigning).toBe(true);
  });
});
