import { describe, expect, it } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import type { Preferences } from "./scout-state.ts";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

const loadPreferences = async (record: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", record);
  return (await createScoutStore(backend).load()).preferences;
};

describe("scout store", () => {
  it("loads nothing from an empty backend", async () => {
    const store = createScoutStore(memoryBackend());
    expect(await store.load()).toEqual({ gameDb: null, preferences: null });
  });

  it("saves and loads the game database and the preferences", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences: Preferences = {
      filters: {
        text: "mes",
        ranges: { age: { min: 18, max: 23 }, dribbling: { min: 80 } },
        lists: { positionGroup: ["wide"], preferredFoot: ["left"], leagueId: [53] },
        flags: { leadership: true, diver: false },
        clubStatus: "all",
        excludeMyClub: true,
      },
      sort: { key: "height", direction: "ascending" },
      showPotential: true,
    };
    await store.saveGameDb(Uint8Array.of(1, 2, 3));
    await store.savePreferences(preferences);
    expect(await store.load()).toEqual({ gameDb: Uint8Array.of(1, 2, 3), preferences });
  });

  it("ignores records of another schema version or shape", async () => {
    const backend = memoryBackend();
    await backend.set("gameDb", {
      schemaVersion: SCHEMA_VERSION.gameDb + 1,
      value: Uint8Array.of(1),
    });
    await backend.set("preferences", {
      schemaVersion: SCHEMA_VERSION.preferences,
      value: { filters: 3 },
    });
    expect(await createScoutStore(backend).load()).toEqual({ gameDb: null, preferences: null });
    await backend.set("gameDb", "junk");
    expect((await createScoutStore(backend).load()).gameDb).toBeNull();
    const unsorted = { filters: {}, sort: { key: "salary", direction: "ascending" } };
    expect(await loadPreferences({ schemaVersion: 3, value: unsorted })).toBeNull();
    expect(
      await loadPreferences({ schemaVersion: 3, value: { filters: {}, sort: { key: "age" } } }),
    ).toBeNull();
    expect(await loadPreferences({ schemaVersion: 3, value: [] })).toBeNull();
  });

  it("drops unknown and malformed filter values", async () => {
    const value = {
      filters: {
        text: 7,
        ranges: {
          age: { min: "18", max: 23 },
          salary: { min: 1 },
          height: 180,
          weight: { max: NaN },
        },
        lists: {
          positionGroup: ["wide", "libero"],
          preferredFoot: ["left", 1],
          leagueId: [53, "x", 1.5],
          shoeColor: [1],
          clubId: "241",
        },
        flags: { leadership: true, diver: "yes", cheater: true },
        clubStatus: "some",
        excludeMyClub: "yes",
      },
      sort: DEFAULT_SORT,
      showPotential: "yes",
    };
    expect(await loadPreferences({ schemaVersion: 3, value })).toEqual({
      filters: {
        ranges: { age: { max: 23 } },
        lists: { positionGroup: ["wide"], preferredFoot: ["left"], leagueId: [53] },
        flags: { leadership: true },
      },
      sort: DEFAULT_SORT,
      showPotential: false,
    });
  });

  it("migrates preferences of version 2 to ranges and lists, with potential hidden", async () => {
    const value = {
      filters: {
        text: "a",
        positionGroups: ["forwards"],
        age: { min: 18 },
        potential: { min: 80 },
        overall: { max: 70 },
        attributeMin: { dribbling: 75, salary: 3, finishing: "x" },
        leagueIds: [53],
        teamIds: [241],
        nationalityIds: [52],
        contractEndsBy: 2011,
        clubStatus: "free-agents",
        excludeMyClub: true,
      },
      sort: { key: "potential", direction: "descending" },
    };
    expect(await loadPreferences({ schemaVersion: 2, value })).toEqual({
      filters: {
        text: "a",
        ranges: {
          age: { min: 18 },
          potential: { min: 80 },
          overall: { max: 70 },
          contractEndYear: { max: 2011 },
          dribbling: { min: 75 },
        },
        lists: { positionGroup: ["forwards"], leagueId: [53], clubId: [241], nationalityId: [52] },
        clubStatus: "free-agents",
        excludeMyClub: true,
      },
      sort: { key: "potential", direction: "descending" },
      showPotential: false,
    });
    expect(
      await loadPreferences({ schemaVersion: 2, value: { filters: {}, sort: DEFAULT_SORT } }),
    ).toEqual({ filters: {}, sort: DEFAULT_SORT, showPotential: false });
  });

  it("drops preferences of version 1 but keeps the stored fifa.db", async () => {
    const backend = memoryBackend();
    await backend.set("preferences", {
      schemaVersion: 1,
      value: { filters: { freeAgentsOnly: false }, sort: DEFAULT_SORT },
    });
    await backend.set("gameDb", { schemaVersion: 1, value: Uint8Array.of(7) });
    expect(SCHEMA_VERSION.preferences).toBe(3);
    expect(await createScoutStore(backend).load()).toEqual({
      gameDb: Uint8Array.of(7),
      preferences: null,
    });
  });
});
