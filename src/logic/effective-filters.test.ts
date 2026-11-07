import { describe, expect, it } from "vitest";
import { effectiveFilters } from "./effective-filters.ts";

const NO_IDS: ReadonlySet<number> = new Set();

describe("effectiveFilters", () => {
  it("keeps the players one can sign unless a career chooses another club status", () => {
    expect(effectiveFilters({}, null, NO_IDS)).toEqual({ clubStatus: "available" });
    expect(effectiveFilters({}, 7, NO_IDS)).toEqual({ clubStatus: "available" });
    expect(effectiveFilters({ clubStatus: "free-agents" }, 7, NO_IDS)).toEqual({
      clubStatus: "free-agents",
    });
    expect(effectiveFilters({ clubStatus: "unavailable" }, 7, NO_IDS)).toEqual({
      clubStatus: "unavailable",
    });
    // The field shows only with a career: fifa.db alone has no free agents.
    expect(effectiveFilters({ clubStatus: "free-agents" }, null, NO_IDS)).toEqual({
      clubStatus: "available",
    });
  });

  it("turns 'my club' into the club id to hide or keep, only with a career", () => {
    expect(effectiveFilters({ myClub: "hide", text: "a" }, 7, NO_IDS)).toEqual({
      text: "a",
      clubStatus: "available",
      excludeTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "only" }, 7, NO_IDS)).toEqual({
      clubStatus: "available",
      onlyTeamId: 7,
    });
    expect(effectiveFilters({ myClub: "hide" }, null, NO_IDS)).toEqual({
      clubStatus: "available",
    });
  });

  it("carries the listed ids while the list field is set", () => {
    const ids = new Set([3, 5]);
    expect(effectiveFilters({ onList: "tool" }, null, ids).myListIds).toBe(ids);
    expect(effectiveFilters({ onList: "none" }, null, ids).myListIds).toBe(ids);
    expect(effectiveFilters({}, null, ids).myListIds).toBeUndefined();
  });
});
