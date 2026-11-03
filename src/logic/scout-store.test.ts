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
    expect(await store.load()).toEqual({
      gameDb: null,
      gameName: null,
      preferences: null,
      languages: {},
      careerSave: null,
    });
  });

  it("saves and loads the game database and the preferences", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences: Preferences = {
      filters: {
        text: "mes",
        ranges: { age: { min: 18, max: 23 }, dribbling: { min: 80 } },
        lists: { positionGroup: ["wide"], preferredFoot: ["left"], leagueId: [53] },
        flags: { leadership: true, diver: false },
        positionRating: { code: 7, min: 70 },
        clubStatus: "free-agents",
        excludeMyClub: true,
      },
      sort: { key: "positionRating", direction: "ascending" },
      showPotential: true,
      gameLanguage: "pol_pl",
    };
    const languages = {
      pol_pl: { teams: { 1: "Klub" }, leagues: { 2: "Liga" }, countries: { 37: "Polska" } },
    };
    await store.saveGameDb(Uint8Array.of(1, 2, 3), "fifa.iso");
    await store.savePreferences(preferences);
    await store.saveLanguages(languages);
    expect(await store.load()).toEqual({
      gameDb: Uint8Array.of(1, 2, 3),
      gameName: "fifa.iso",
      preferences,
      languages,
      careerSave: null,
    });
    await store.savePreferences({ ...preferences, gameLanguage: null });
    expect((await store.load()).preferences?.gameLanguage).toBeNull();
    expect(
      await loadPreferences({ schemaVersion: 3, value: { ...preferences, gameLanguage: 5 } }),
    ).not.toHaveProperty("gameLanguage");
  });

  // Loading runs compactFilters too, so this covers the order in the session as well.
  it("keeps ranges in the order they were added, which orders the attribute columns", async () => {
    const value = { filters: { ranges: { finishing: { min: 1 }, dribbling: { max: 2 } } } };
    const loaded = await loadPreferences({
      schemaVersion: 3,
      value: { ...value, sort: DEFAULT_SORT },
    });
    expect(Object.keys(loaded?.filters.ranges ?? {})).toEqual(["finishing", "dribbling"]);
  });

  it("saves, loads and forgets the career save", async () => {
    const backend = memoryBackend();
    const store = createScoutStore(backend);
    const save = { dataBin: Uint8Array.of(1, 2), paramSfo: Uint8Array.of(3) };
    await store.saveCareerSave(save);
    expect((await store.load()).careerSave).toEqual(save);
    await store.saveCareerSave(null);
    expect((await store.load()).careerSave).toBeNull();
    await backend.set("careerSave", {
      schemaVersion: SCHEMA_VERSION.careerSave,
      value: { dataBin: Uint8Array.of(1), paramSfo: "x" },
    });
    expect((await store.load()).careerSave).toBeNull();
  });

  it("drops stored languages of a wrong shape one by one", async () => {
    const backend = memoryBackend();
    const good = { teams: { 1: "Klub" }, leagues: {}, countries: {} };
    await backend.set("languages", {
      schemaVersion: SCHEMA_VERSION.languages,
      value: {
        pol_pl: good,
        cze_cz: { teams: { 1: 5 }, leagues: {}, countries: {} },
        hun_hu: { teams: {}, leagues: {} },
        eng_us: "junk",
      },
    });
    expect((await createScoutStore(backend).load()).languages).toEqual({ pol_pl: good });
    await backend.set("languages", { schemaVersion: 99, value: { pol_pl: good } });
    expect((await createScoutStore(backend).load()).languages).toEqual({});
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
    expect(await createScoutStore(backend).load()).toEqual({
      gameDb: null,
      gameName: null,
      preferences: null,
      languages: {},
      careerSave: null,
    });
    await backend.set("gameDb", "junk");
    expect((await createScoutStore(backend).load()).gameDb).toBeNull();
    const unsorted = { filters: {}, sort: { key: "salary", direction: "ascending" } };
    expect(await loadPreferences({ schemaVersion: 3, value: unsorted })).toBeNull();
    expect(
      await loadPreferences({ schemaVersion: 3, value: { filters: {}, sort: { key: "age" } } }),
    ).toBeNull();
    expect(await loadPreferences({ schemaVersion: 3, value: [] })).toBeNull();
    expect(await loadPreferences({ schemaVersion: 2, value: "junk" })).toBeNull();
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
        // "all" was an option of earlier versions.
        clubStatus: "all",
        excludeMyClub: "yes",
        positionRating: { code: 32, min: 1 },
      },
      sort: DEFAULT_SORT,
      showPotential: "yes",
    };
    const rating = (positionRating: unknown) =>
      loadPreferences({
        schemaVersion: 3,
        value: { filters: { positionRating }, sort: DEFAULT_SORT },
      });
    expect((await rating({ code: 0, max: "9" }))?.filters).toEqual({ positionRating: { code: 0 } });
    expect((await rating({ code: 1.5 }))?.filters).toEqual({});
    expect((await rating(5))?.filters).toEqual({});
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

  it("drops preferences of version 1 but keeps the stored fifa.db of version 1 without a name", async () => {
    const backend = memoryBackend();
    await backend.set("preferences", {
      schemaVersion: 1,
      value: { filters: { freeAgentsOnly: false }, sort: DEFAULT_SORT },
    });
    await backend.set("gameDb", { schemaVersion: 1, value: Uint8Array.of(7) });
    expect(SCHEMA_VERSION.preferences).toBe(3);
    expect(await createScoutStore(backend).load()).toEqual({
      gameDb: Uint8Array.of(7),
      gameName: null,
      preferences: null,
      languages: {},
      careerSave: null,
    });
  });
});
