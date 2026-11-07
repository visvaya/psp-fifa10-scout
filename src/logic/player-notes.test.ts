import { describe, expect, it } from "vitest";
import { SCOUT_CONFIG } from "./config.ts";
import { firstLine, notedPlayer, notesNewestFirst } from "./player-notes.ts";
import type { PlayerNote } from "./player-notes.ts";
import { initialScoutState, scoutReducer } from "./scout-state.ts";

const note = (
  playerId: number,
  text: string,
  changedAt = "2026-11-05T10:00:00.000Z",
): PlayerNote => ({
  playerId,
  text,
  name: `Player ${String(playerId)}`,
  changedAt,
});

describe("notedPlayer", () => {
  it("adds a note and replaces a player's note with the new time", () => {
    const added = notedPlayer([note(1, "a")], note(2, "b"));
    expect(added).toEqual([note(1, "a"), note(2, "b")]);
    const changed = notedPlayer(added, note(1, "c", "2026-11-06T10:00:00.000Z"));
    expect(changed).toEqual([note(1, "c", "2026-11-06T10:00:00.000Z"), note(2, "b")]);
  });

  it("removes the note when its text is empty or only spaces", () => {
    expect(notedPlayer([note(1, "a"), note(2, "b")], note(1, ""))).toEqual([note(2, "b")]);
    expect(notedPlayer([note(1, "a")], note(1, " \n "))).toEqual([]);
    expect(notedPlayer([], note(3, ""))).toEqual([]);
  });

  it("cuts a note to the technical limit", () => {
    const long = "x".repeat(SCOUT_CONFIG.noteMaxChars + 5);
    expect(notedPlayer([], note(1, long))[0]?.text).toHaveLength(SCOUT_CONFIG.noteMaxChars);
  });
});

describe("notesNewestFirst", () => {
  it("orders the notes by their last change, newest first", () => {
    const older = note(1, "a", "2026-11-01T10:00:00.000Z");
    const newer = note(2, "b", "2026-11-06T10:00:00.000Z");
    expect(notesNewestFirst([older, newer])).toEqual([newer, older]);
  });
});

describe("firstLine", () => {
  it("is the first line with text, trimmed", () => {
    expect(firstLine("\n  fast winger \nleft foot")).toBe("fast winger");
    expect(firstLine("one line")).toBe("one line");
  });
});

describe("notes in the app state", () => {
  it("restores the stored notes without an edit, and a change is an edit outside undo", () => {
    const restored = scoutReducer(initialScoutState, {
      type: "notes-restored",
      notes: [note(9, "x")],
    });
    expect(restored.notes).toEqual([note(9, "x")]);
    expect(restored.notesEdited).toBe(false);
    const changed = scoutReducer(restored, {
      type: "note-changed",
      id: 4,
      text: "wing",
      name: "Player 4",
      changedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(changed.notes).toEqual([note(9, "x"), note(4, "wing")]);
    expect(changed.notesEdited).toBe(true);
    expect(changed.undo).toEqual([]);
  });

  it("removes one player's note as an edit", () => {
    const restored = scoutReducer(initialScoutState, {
      type: "notes-restored",
      notes: [note(9, "x"), note(4, "y")],
    });
    const removed = scoutReducer(restored, { type: "note-removed", id: 9 });
    expect(removed.notes).toEqual([note(4, "y")]);
    expect(removed.notesEdited).toBe(true);
  });

  it("keeps a note when the player leaves the own list, and adds none to it", () => {
    const listed = scoutReducer(initialScoutState, {
      type: "watch-added",
      id: 4,
      addedAt: "2026-11-05T10:00:00.000Z",
    });
    const noted = scoutReducer(listed, {
      type: "note-changed",
      id: 7,
      text: "wing",
      name: "Player 7",
      changedAt: "2026-11-05T10:00:00.000Z",
    });
    expect(noted.watchlist.map((entry) => entry.playerId)).toEqual([4]);
    const unlisted = scoutReducer(
      scoutReducer(noted, { type: "watch-added", id: 7, addedAt: "2026-11-05T10:00:00.000Z" }),
      { type: "watch-removed", id: 7 },
    );
    expect(unlisted.notes).toEqual([note(7, "wing")]);
  });
});
