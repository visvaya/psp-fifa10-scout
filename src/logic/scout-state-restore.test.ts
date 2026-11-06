import { describe, expect, it } from "vitest";
import { initialScoutState, isRestoring, scoutReducer } from "./scout-state.ts";
import type { ScoutAction, ScoutState } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";

const started = (
  extra: Omit<Extract<ScoutAction, { type: "load-started" }>, "type" | "requestId"> = {},
  state: ScoutState = initialScoutState,
  requestId = 1,
): ScoutState => scoutReducer(state, { type: "load-started", requestId, ...extra });

const succeeded = (state: ScoutState, requestId = 1): ScoutState =>
  scoutReducer(state, {
    type: "load-succeeded",
    requestId,
    players: [testPlayer({ id: 1 })],
    myTeamId: null,
    career: null,
    languages: {},
    attachedLanguage: null,
  });

describe("loading a picked or a stored game", () => {
  it("drops the game shortlist filter when the game comes without a career", () => {
    const filters = { flags: { shortlisted: true, leadership: true } };
    expect(succeeded({ ...started(), filters }).filters).toEqual({ flags: { leadership: true } });
  });

  it("drops the career filters and sort of preferences restored after a game without a career", () => {
    const restored = scoutReducer(succeeded(started()), {
      type: "preferences-restored",
      preferences: {
        filters: { ranges: { price: { min: 1 }, age: { max: 30 } } },
        sort: { key: "price", direction: "descending" },
        showPotential: false,
      },
    });
    expect(restored.filters).toEqual({ ranges: { age: { max: 30 } } });
    expect(restored.sort.key).not.toBe("price");
  });

  it("stays on the start view after a picked file and opens the list after the stored game", () => {
    expect(succeeded(started()).view).toBe("start");
    expect(succeeded(started({ restored: true })).view).toBe("list");
  });

  it("keeps the game file name of the last good load; a reload with the same game keeps it", () => {
    const picked = succeeded(started({ gameName: "fifa.iso" }));
    expect(picked.gameName).toBe("fifa.iso");
    expect(succeeded(started({}, picked, 2), 2).gameName).toBe("fifa.iso");
    expect(succeeded(started({ restored: true, gameName: null })).gameName).toBeNull();
  });

  it("is restoring only while the stored game loads and no players exist yet", () => {
    const restoring = started({ restored: true });
    expect(isRestoring(restoring)).toBe(true);
    expect(isRestoring(started())).toBe(false);
    expect(isRestoring(started({ restored: true }, succeeded(started()), 2))).toBe(false);
    const error = { stage: "game", kind: "wrong-file" } as const;
    expect(isRestoring(scoutReducer(restoring, { type: "load-failed", requestId: 1, error }))).toBe(
      false,
    );
  });
});
