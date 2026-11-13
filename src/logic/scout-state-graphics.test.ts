import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import { canResetSettings } from "./settings-reset.ts";

const pack = (byte: number) => ({ bytes: Uint8Array.of(byte), entries: [["tl1", 0, 1]] as const });

describe("the game's graphics in the state", () => {
  it("keeps them until the store or a load brings others", () => {
    expect(initialScoutState.graphics).toBeNull();
    const restored = scoutReducer(initialScoutState, {
      type: "graphics-loaded",
      graphics: pack(1),
    });
    expect(restored.graphics).toEqual(pack(1));
    // A bare or the stored fifa.db has none: the shown graphics stay, through the next load too.
    expect(scoutReducer(restored, { type: "graphics-loaded", graphics: null })).toBe(restored);
    expect(scoutReducer(restored, { type: "load-started", requestId: 1 }).graphics).toEqual(
      pack(1),
    );
    expect(scoutReducer(restored, { type: "graphics-loaded", graphics: pack(2) }).graphics).toEqual(
      pack(2),
    );
  });
});

describe("the approximate portraits switch", () => {
  const on = scoutReducer(initialScoutState, { type: "approximate-portraits-shown", shown: true });

  it("is off by default, turned on and off, and not an undo step", () => {
    expect(initialScoutState.approximatePortraits).toBeUndefined();
    expect(on.approximatePortraits).toBe(true);
    expect(on.undo).toEqual([]);
    const off = scoutReducer(on, { type: "approximate-portraits-shown", shown: false });
    expect(off).not.toHaveProperty("approximatePortraits");
  });

  it("is turned off by Resetuj, which then has something to reset", () => {
    expect(canResetSettings(on)).toBe(true);
    expect(scoutReducer(on, { type: "settings-reset" })).not.toHaveProperty("approximatePortraits");
  });

  it("is restored from the stored preferences", () => {
    const preferences = { filters: {}, sort: initialScoutState.sort, showPotential: false };
    const restored = (approximatePortraits?: true) =>
      scoutReducer(initialScoutState, {
        type: "preferences-restored",
        preferences: approximatePortraits ? { ...preferences, approximatePortraits } : preferences,
      }).approximatePortraits;
    expect(restored(true)).toBe(true);
    expect(restored()).toBeUndefined();
  });
});
