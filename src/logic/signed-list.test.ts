import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import type { ScoutState } from "./scout-state.ts";
import { offerTerms } from "./offer.ts";
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

const moneyShown = (state: ScoutState) =>
  shownPlayers(state)?.map(({ price, wage }) => ({ price, wage }));

/** The least wage the offer form asks for BEFORE at a contract of `years`. */
const needed = (years: number) =>
  offerTerms(BEFORE, TEST_CAREER.offer, { double: false, bonusPercent: 0, years })?.wage;

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

  it("keeps the money before signing for a player without values at the user's club", () => {
    const richer = testPlayer({ id: 1, potential: 84, price: 20_000_000, priceEuro: 20_000_000 });
    const ready = built(switched(loaded(initialScoutState)), [richer]);
    expect(
      shownPlayers(ready)?.map(({ potential, price, wage }) => ({ potential, price, wage })),
    ).toEqual([{ potential: 84, price: 15_000_000, wage: 8700 }]);
  });

  // Owner, 2026-11-14 (roadmap 56(c)): after a transfer his price is his value at the user's club for
  // the contract he wants, or for the length chosen beside the switch, and his wage the market wage there.
  const SIGNED = testPlayer({
    id: 1,
    potential: 84,
    ...money,
    signedValuesEuro: [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000],
    signedWageEuro: 10_000,
  });

  it("prices a player at the user's club for the contract he wants", () => {
    // Born 1984, retiring at 35, the season ending in 2010; id 1 wants (1 mod 5) + 1 = 2 years.
    const ready = built(switched(loaded(initialScoutState)), [SIGNED]);
    expect(moneyShown(ready)).toEqual([{ price: 2_000_000, wage: 10_000 }]);
  });

  // Owner, 2026-11-14 (decision 1b): the wage he will be paid, the least his offer needs, beside the market wage.
  it("gives the wage his offer needs at the user's club for the length he wants or the one chosen", () => {
    const ready = built(switched(loaded(initialScoutState)), [SIGNED]);
    expect(shownPlayers(ready)?.[0]?.transferWage).toBe(needed(2));
    const four = scoutReducer(ready, { type: "transfer-years-chosen", years: 4 });
    expect(shownPlayers(four)?.[0]?.transferWage).toBe(needed(4));
    expect(needed(4)).not.toBe(needed(2));
  });

  it("gives no wage after a transfer to a player without values at the user's club", () => {
    const ready = built(switched(loaded(initialScoutState)), [AFTER]);
    expect(shownPlayers(ready)?.[0]?.transferWage).toBeNull();
    expect(shownPlayers(loaded(initialScoutState))?.[0]?.transferWage).toBeNull();
  });

  it("prices him for the contract length chosen, and for the one he wants again", () => {
    const ready = built(switched(loaded(initialScoutState)), [SIGNED]);
    const four = scoutReducer(ready, { type: "transfer-years-chosen", years: 4 });
    expect(four.transferYears).toBe(4);
    expect(moneyShown(four)).toEqual([{ price: 4_000_000, wage: 10_000 }]);
    const wanted = scoutReducer(four, { type: "transfer-years-chosen", years: null });
    expect(wanted.transferYears).toBeUndefined();
    expect(moneyShown(wanted)).toEqual([{ price: 2_000_000, wage: 10_000 }]);
  });

  it("keeps the length chosen before the list is built, and prices the list with it", () => {
    const chosen = scoutReducer(switched(loaded(initialScoutState)), {
      type: "transfer-years-chosen",
      years: 5,
    });
    expect(chosen.signed).toBeUndefined();
    expect(moneyShown(built(chosen, [SIGNED]))).toEqual([{ price: 5_000_000, wage: 10_000 }]);
  });

  it("keeps a built player the list before signing does not know as built", () => {
    const stranger = { ...SIGNED, id: 2 };
    const ready = built(switched(loaded(initialScoutState)), [stranger]);
    expect(moneyShown(ready)).toEqual([{ price: 15_000_000, wage: 8700 }]);
  });

  it("has no price for a player any contract would outlast", () => {
    const old = { ...SIGNED, birthYear: 1975 };
    const state = loaded(initialScoutState);
    const ready = built(switched({ ...state, players: [{ ...BEFORE, birthYear: 1975 }] }), [old]);
    expect(moneyShown(ready)).toEqual([{ price: null, wage: 10_000 }]);
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
    const chosen = scoutReducer(on, { type: "transfer-years-chosen", years: 3 });
    expect(
      canResetSettings(scoutReducer(chosen, { type: "after-signing-shown", shown: false })),
    ).toBe(true);
    expect(scoutReducer(chosen, { type: "settings-reset" }).transferYears).toBeUndefined();
  });

  it("is restored from the stored preferences", () => {
    const restored = scoutReducer(initialScoutState, {
      type: "preferences-restored",
      preferences: {
        filters: {},
        sort: initialScoutState.sort,
        showPotential: false,
        afterSigning: true,
        transferYears: 3,
      },
    });
    expect(restored.afterSigning).toBe(true);
    expect(restored.transferYears).toBe(3);
  });
});
