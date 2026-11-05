import { describe, expect, it } from "vitest";
import { SCOUT_CONFIG } from "./config.ts";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import { notedPlayer, unwatchedPlayer, watchedIds, watchedPlayer } from "./watchlist.ts";
import type { WatchEntry } from "./watchlist.ts";

const entry = (playerId: number, note = ""): WatchEntry => ({
  playerId,
  note,
  addedAt: "2026-11-05T10:00:00.000Z",
});

describe("watchedPlayer", () => {
  it("adds a player last with an empty note and the time", () => {
    expect(watchedPlayer([entry(1)], 2, "2026-11-06T08:00:00.000Z")).toEqual([
      entry(1),
      { playerId: 2, note: "", addedAt: "2026-11-06T08:00:00.000Z" },
    ]);
  });

  it("keeps a player already on the list as he is", () => {
    const list = [entry(1, "fast")];
    expect(watchedPlayer(list, 1, "2026-11-06T08:00:00.000Z")).toBe(list);
  });
});

describe("unwatchedPlayer", () => {
  it("removes the player with his note", () => {
    expect(unwatchedPlayer([entry(1, "a"), entry(2)], 1)).toEqual([entry(2)]);
  });
});

describe("notedPlayer", () => {
  it("changes only that player's note", () => {
    expect(notedPlayer([entry(1), entry(2, "old")], 2, "new")).toEqual([entry(1), entry(2, "new")]);
  });

  it("cuts a note to the limit", () => {
    const long = "x".repeat(SCOUT_CONFIG.watchlistNoteMaxChars + 5);
    expect(notedPlayer([entry(1)], 1, long)[0]?.note).toHaveLength(
      SCOUT_CONFIG.watchlistNoteMaxChars,
    );
  });

  it("changes nothing for a player not on the list", () => {
    const list = [entry(1)];
    expect(notedPlayer(list, 9, "x")).toBe(list);
  });
});

describe("watchedIds", () => {
  it("holds the ids of the listed players", () => {
    expect(watchedIds([entry(3), entry(5)])).toEqual(new Set([3, 5]));
  });
});

describe("watchlist in the app state", () => {
  it("adds, notes and removes a player, and restores a stored list", () => {
    const added = scoutReducer(initialScoutState, {
      type: "watch-added",
      id: 4,
      addedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(added.watchlist).toEqual([entry(4)]);
    const noted = scoutReducer(added, { type: "watch-note-changed", id: 4, note: "wing" });
    expect(noted.watchlist).toEqual([entry(4, "wing")]);
    expect(scoutReducer(noted, { type: "watch-removed", id: 4 }).watchlist).toEqual([]);
    const restored = scoutReducer(initialScoutState, {
      type: "watchlist-restored",
      watchlist: [entry(9)],
    });
    expect(restored.watchlist).toEqual([entry(9)]);
  });

  it("is not a step of undo", () => {
    const added = scoutReducer(initialScoutState, {
      type: "watch-added",
      id: 4,
      addedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(added.undo).toEqual([]);
  });
});
