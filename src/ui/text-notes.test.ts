import { describe, expect, it } from "vitest";
import { NOTES_TEXT } from "./text-notes.ts";

describe("NOTES_TEXT.changed", () => {
  // Owner, 2026-11-09: the date of a note with its hour, minutes and seconds.
  it("gives the date of the last change with the time to the second", () => {
    const at = new Date(2026, 10, 10, 22, 31, 5).toISOString();
    expect(NOTES_TEXT.changed(at)).toBe("zmieniona 10 lis 2026, 22:31:05");
  });
});
