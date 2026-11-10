import { describe, expect, it } from "vitest";
import { initialScoutState, scoutReducer } from "./scout-state.ts";
import { testPlayer } from "./test-support/player-fixtures.ts";
import { listedPlayers, unwatchedPlayer, watchedIds, watchedPlayer } from "./watchlist.ts";
import type { WatchEntry } from "./watchlist.ts";

const entry = (playerId: number, addedAt = "2026-11-05T10:00:00.000Z"): WatchEntry => ({
  playerId,
  addedAt,
});

describe("listedPlayers", () => {
  const players = [
    testPlayer({ id: 1, overall: 60, shortlisted: true }),
    testPlayer({ id: 2, overall: 80 }),
    testPlayer({ id: 3, overall: 70, shortlisted: true }),
  ];

  it("gives the own list latest added first, an id the players lack without a player", () => {
    const list = [
      entry(2, "2026-11-01T10:00:00.000Z"),
      entry(9),
      entry(1, "2026-11-03T10:00:00.000Z"),
    ];
    expect(listedPlayers("tool", list, players).map(({ id, player }) => [id, player?.id])).toEqual([
      [9, undefined],
      [1, 1],
      [2, 2],
    ]);
  });

  it("gives the game's shortlist by OVR, highest first", () => {
    expect(listedPlayers("game", [entry(2)], players).map(({ id }) => id)).toEqual([3, 1]);
  });
});

describe("watchedPlayer", () => {
  it("adds a player last with the time", () => {
    expect(watchedPlayer([entry(1)], 2, "2026-11-06T08:00:00.000Z")).toEqual([
      entry(1),
      { playerId: 2, addedAt: "2026-11-06T08:00:00.000Z" },
    ]);
  });

  it("keeps a player already on the list as he is", () => {
    const list = [entry(1)];
    expect(watchedPlayer(list, 1, "2026-11-06T08:00:00.000Z")).toBe(list);
  });
});

describe("unwatchedPlayer", () => {
  it("removes the player", () => {
    expect(unwatchedPlayer([entry(1), entry(2)], 1)).toEqual([entry(2)]);
  });
});

describe("watchedIds", () => {
  it("holds the ids of the listed players", () => {
    expect(watchedIds([entry(3), entry(5)])).toEqual(new Set([3, 5]));
  });
});

describe("watchlist in the app state", () => {
  it("adds and removes a player, and restores a stored list", () => {
    const added = scoutReducer(initialScoutState, {
      type: "watch-added",
      id: 4,
      addedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(added.watchlist).toEqual([entry(4)]);
    expect(scoutReducer(added, { type: "watch-removed", id: 4 }).watchlist).toEqual([]);
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

describe("watchlistEdited", () => {
  it("is set by the user's changes and not by restoring the stored list", () => {
    expect(initialScoutState.watchlistEdited).toBe(false);
    const restored = scoutReducer(initialScoutState, {
      type: "watchlist-restored",
      watchlist: [entry(9)],
    });
    expect(restored.watchlistEdited).toBe(false);
    const added = scoutReducer(restored, { type: "watch-added", id: 4, addedAt: entry(4).addedAt });
    expect(added.watchlistEdited).toBe(true);
    expect(scoutReducer(added, { type: "watch-removed", id: 4 }).watchlistEdited).toBe(true);
  });
});
