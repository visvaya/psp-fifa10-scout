import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";

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
