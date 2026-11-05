import { describe, expect, it } from "vitest";
import { testPlayer } from "../logic/test-support/player-fixtures.ts";
import { clubText } from "./player-list.tsx";

describe("clubText", () => {
  it("names the club, or says why a player has none", () => {
    expect(clubText(testPlayer({ clubName: "Wisła Kraków" }))).toBe("Wisła Kraków");
    const clubless = { clubId: null, clubName: null } as const;
    expect(clubText(testPlayer({ ...clubless, youth: true, academy: true }))).toBe("junior");
    // A scouted junior on the shortlist, not signed: the game says he has no contract.
    expect(clubText(testPlayer({ ...clubless, youth: true }))).toBe("bez kontraktu");
    expect(clubText(testPlayer({ ...clubless, youth: true, freeAgent: true }))).toBe(
      "wolny zawodnik",
    );
    expect(clubText(testPlayer({ ...clubless, freeAgent: true }))).toBe("wolny zawodnik");
  });
});
