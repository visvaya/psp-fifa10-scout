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

// "Przybliżone portrety" (roadmap 110) and "Zawsze pokazuj portrety" (roadmap 117).
describe.each(["approximatePortraits", "alwaysPortraits"] as const)("the %s switch", (setting) => {
  const on = scoutReducer(initialScoutState, { type: "portraits-chosen", setting, on: true });

  it("is off by default, turned on and off, and not an undo step", () => {
    expect(initialScoutState[setting]).toBeUndefined();
    expect(on[setting]).toBe(true);
    expect(on.undo).toEqual([]);
    const off = scoutReducer(on, { type: "portraits-chosen", setting, on: false });
    expect(off).not.toHaveProperty(setting);
  });

  it("leaves the other portrait switch as it is", () => {
    const other = setting === "alwaysPortraits" ? "approximatePortraits" : "alwaysPortraits";
    const both = scoutReducer(on, { type: "portraits-chosen", setting: other, on: true });
    expect(scoutReducer(both, { type: "portraits-chosen", setting, on: false })[other]).toBe(true);
  });

  it("is turned off by Resetuj, which then has something to reset", () => {
    expect(canResetSettings(on)).toBe(true);
    expect(scoutReducer(on, { type: "settings-reset" })).not.toHaveProperty(setting);
  });

  it("is restored from the stored preferences", () => {
    const preferences = { filters: {}, sort: initialScoutState.sort, showPotential: false };
    const restored = (stored?: true) =>
      scoutReducer(initialScoutState, {
        type: "preferences-restored",
        preferences: stored ? { ...preferences, [setting]: stored } : preferences,
      })[setting];
    expect(restored(true)).toBe(true);
    expect(restored()).toBeUndefined();
  });
});
