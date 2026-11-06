import { describe, expect, it } from "vitest";
import { effectiveFilters } from "./effective-filters.ts";

const NO_IDS: ReadonlySet<number> = new Set();

describe("effectiveFilters", () => {
  it("keeps the players one can sign, or only free agents in a career", () => {
    expect(effectiveFilters({}, null, NO_IDS)).toEqual({ availableOnly: true });
    expect(effectiveFilters({}, 7, NO_IDS)).toEqual({ availableOnly: true });
    expect(effectiveFilters({ clubStatus: "free-agents" }, 7, NO_IDS)).toEqual({
      freeAgentsOnly: true,
    });
    // Without a career fifa.db has no free agents, so the option does not apply.
    expect(effectiveFilters({ clubStatus: "free-agents" }, null, NO_IDS)).toEqual({
      availableOnly: true,
    });
  });

  it("turns 'my club' into the club id to hide or keep, only with a career", () => {
    expect(effectiveFilters({ myClub: "hide", text: "a" }, 7, NO_IDS)).toEqual({
      text: "a",
      availableOnly: true,
      excludeTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "only" }, 7, NO_IDS)).toEqual({
      availableOnly: true,
      onlyTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "hide" }, null, NO_IDS)).toEqual({ availableOnly: true });
  });

  it("carries the listed ids while the own list filter is set", () => {
    const ids = new Set([3, 5]);
    expect(effectiveFilters({ flags: { onMyList: true } }, null, ids).myListIds).toBe(ids);
    expect(effectiveFilters({}, null, ids).myListIds).toBeUndefined();
  });
});
