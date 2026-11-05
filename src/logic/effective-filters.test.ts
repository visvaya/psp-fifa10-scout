import { describe, expect, it } from "vitest";
import { effectiveFilters } from "./effective-filters.ts";

describe("effectiveFilters", () => {
  it("keeps the players one can sign, or only free agents in a career", () => {
    expect(effectiveFilters({}, null, [])).toEqual({ availableOnly: true });
    expect(effectiveFilters({}, 7, [])).toEqual({ availableOnly: true });
    expect(effectiveFilters({ clubStatus: "free-agents" }, 7, [])).toEqual({
      freeAgentsOnly: true,
    });
    // Without a career fifa.db has no free agents, so the option does not apply.
    expect(effectiveFilters({ clubStatus: "free-agents" }, null, [])).toEqual({
      availableOnly: true,
    });
  });

  it("turns 'my club' into the club id to hide or keep, only with a career", () => {
    expect(effectiveFilters({ myClub: "hide", text: "a" }, 7, [])).toEqual({
      text: "a",
      availableOnly: true,
      excludeTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "only" }, 7, [])).toEqual({
      availableOnly: true,
      onlyTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "hide" }, null, [])).toEqual({ availableOnly: true });
  });

  it("carries the listed ids while the own list filter is set", () => {
    const list = [3, 5].map((playerId) => ({
      playerId,
      note: "",
      addedAt: "2026-11-05T10:00:00.000Z",
    }));
    expect(effectiveFilters({ flags: { onMyList: true } }, null, list).myListIds).toEqual(
      new Set([3, 5]),
    );
    expect(effectiveFilters({}, null, list).myListIds).toBeUndefined();
  });
});
