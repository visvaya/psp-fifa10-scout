import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import type { Preferences } from "./scout-state.ts";
import { createScoutStore, memoryBackend, openScoutStore, SCHEMA_VERSION } from "./scout-store.ts";
import type { StorageBackend } from "./scout-store.ts";

const loadPreferences = async (record: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", record);
  return (await createScoutStore(backend).load()).preferences;
};

/** The position groups of version 3 preferences, as loaded. */
const loadV3Groups = async (positionGroup: unknown) =>
  (
    await loadPreferences({
      schemaVersion: 3,
      value: { filters: { lists: { positionGroup } }, sort: DEFAULT_SORT },
    })
  )?.filters.lists?.positionGroup;

describe("scout store", () => {
  it("loads nothing from an empty backend", async () => {
    const store = createScoutStore(memoryBackend());
    expect(await store.load()).toEqual({
      gameDb: null,
      gameName: null,
      preferences: null,
      languages: {},
      careerSave: null,
      watchlist: [],
    });
  });

  it("saves and loads the game database and the preferences", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences: Preferences = {
      filters: {
        text: "mes",
        ranges: { age: { min: 18, max: 23 }, dribbling: { min: 80 } },
        lists: { positionGroup: ["wingers"], preferredFoot: ["left"], leagueId: [53] },
        excludedLists: { leagueId: true },
        flags: { leadership: true, diver: false },
        positionRating: { code: 3, min: 70 },
        clubStatus: "free-agents",
        myClub: "only",
      },
      sort: { key: "positionRating", direction: "ascending" },
      showPotential: true,
      gameLanguage: "pol_pl",
    };
    const languages = {
      pol_pl: {
        teams: { 1: "Klub" },
        leagues: { 2: "Liga" },
        countries: { 37: "Polska" },
        positions: { 0: "BR" },
        positionNames: {},
      },
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
      watchlist: [],
    });
    await store.savePreferences({ ...preferences, gameLanguage: null });
    expect((await store.load()).preferences?.gameLanguage).toBeNull();
    expect(
      await loadPreferences({ schemaVersion: 3, value: { ...preferences, gameLanguage: 5 } }),
    ).not.toHaveProperty("gameLanguage");
  });

  // Loading runs compactFilters too, so this covers the order in the session as well.
  it("keeps the named filter sets with the preferences, dropping malformed ones", async () => {
    const set = { name: "Perełki", filters: { ranges: { age: { max: 21 } } }, sort: DEFAULT_SORT };
    const value = {
      filters: {},
      sort: DEFAULT_SORT,
      filterSets: [
        set,
        { name: "", filters: {}, sort: DEFAULT_SORT },
        { name: "X", sort: 1 },
        { name: " Perełki ", filters: {}, sort: DEFAULT_SORT },
      ],
    };
    const loaded = await loadPreferences({ schemaVersion: SCHEMA_VERSION.preferences, value });
    expect(loaded?.filterSets).toEqual([set]);
  });

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
    const good = {
      teams: { 1: "Klub" },
      leagues: {},
      countries: {},
      positions: { 0: "BR" },
      positionNames: {},
    };
    await backend.set("languages", {
      schemaVersion: SCHEMA_VERSION.languages,
      value: {
        pol_pl: good,
        cze_cz: { teams: { 1: 5 }, leagues: {}, countries: {}, positions: {} },
        ger_de: { teams: {}, leagues: {}, countries: {}, positions: { 0: 1 } },
        hun_hu: { teams: {}, leagues: {} },
        eng_us: "junk",
      },
    });
    expect((await createScoutStore(backend).load()).languages).toEqual({ pol_pl: good });
    await backend.set("languages", { schemaVersion: 99, value: { pol_pl: good } });
    expect((await createScoutStore(backend).load()).languages).toEqual({});
  });

  it("loads languages stored before positions had full names, with abbreviations only", async () => {
    const backend = memoryBackend();
    const v2 = { teams: {}, leagues: {}, countries: {}, positions: { 0: "BR" } };
    await backend.set("languages", { schemaVersion: 2, value: { pol_pl: v2 } });
    expect((await createScoutStore(backend).load()).languages).toEqual({
      pol_pl: { ...v2, positionNames: {} },
    });
  });

  it("loads languages stored before positions had names, with no position names", async () => {
    const backend = memoryBackend();
    const v1 = { teams: { 1: "Klub" }, leagues: {}, countries: {} };
    await backend.set("languages", { schemaVersion: 1, value: { pol_pl: v1 } });
    expect((await createScoutStore(backend).load()).languages).toEqual({
      pol_pl: { ...v1, positions: {}, positionNames: {} },
    });
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
      watchlist: [],
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

  it("restores the price, wage and peak gain ranges and sorting by them", async () => {
    const stored = (["price", "wage", "peakGain"] as const).map((key): Preferences => ({
      filters: { ranges: { [key]: { min: 0, max: 1_000_000 } } },
      sort: { key, direction: "ascending" },
      showPotential: key === "peakGain",
    }));
    const loaded = await Promise.all(
      stored.map(async (value) =>
        loadPreferences({ schemaVersion: SCHEMA_VERSION.preferences, value }),
      ),
    );
    expect(loaded).toEqual(stored);
  });

  it("restores the group average and spread ranges and sorting by them", async () => {
    const stored = (["physicalAverage", "goalkeepingSpread"] as const).map((key): Preferences => ({
      filters: { ranges: { [key]: { min: 60.5, max: 80 } } },
      sort: { key, direction: "descending" },
      showPotential: false,
    }));
    const loaded = await Promise.all(
      stored.map(async (value) =>
        loadPreferences({ schemaVersion: SCHEMA_VERSION.preferences, value }),
      ),
    );
    expect(loaded).toEqual(stored);
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
        myClub: "mine",
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
    expect((await rating({ code: 5, gain: { min: "x", max: -2 } }))?.filters).toEqual({
      positionRating: { code: 5, gain: { max: -2 } },
    });
    expect((await rating({ code: 5, peak: { min: 70, max: "x" }, gain: {} }))?.filters).toEqual({
      positionRating: { code: 5, peak: { min: 70 } },
    });
    expect((await rating({ code: 5, bestOnly: true }))?.filters).toEqual({
      positionRating: { code: 5, bestOnly: true },
    });
    expect((await rating({ code: 5, bestOnly: "yes" }))?.filters).toEqual({
      positionRating: { code: 5 },
    });
    // Codes rated alike move to their rating choice: right centre-back to centre-back.
    expect((await rating({ code: 4, min: 60 }))?.filters).toEqual({
      positionRating: { code: 5, min: 60 },
    });
    expect((await rating({ code: 1.5 }))?.filters).toEqual({});
    expect((await rating(5))?.filters).toEqual({});
    expect(await loadPreferences({ schemaVersion: 3, value })).toEqual({
      filters: {
        ranges: { age: { max: 23 } },
        lists: {
          positionGroup: ["side-midfield", "wingers"],
          preferredFoot: ["left"],
          leagueId: [53],
        },
        flags: { leadership: true },
      },
      sort: DEFAULT_SORT,
      showPotential: false,
    });
  });

  // Version 4 kept the average match rating range in the save's tenths (65 for 6,5).
  it("migrates the rating range of version 4 to the rating itself", async () => {
    const value = {
      filters: { ranges: { form: { min: 65, max: 72 }, age: { max: 23 } } },
      sort: { key: "form", direction: "descending" },
    };
    expect(await loadPreferences({ schemaVersion: 4, value })).toMatchObject({
      filters: { ranges: { form: { min: 6.5, max: 7.2 }, age: { max: 23 } } },
      sort: { key: "form", direction: "descending" },
    });
  });

  it("splits the position groups of version 3 as they are now", async () => {
    expect(await loadV3Groups(["full-backs", "goalkeeper"])).toEqual([
      "full-backs",
      "sweeper",
      "goalkeeper",
    ]);
    expect(await loadV3Groups(["wide", 5])).toEqual(["side-midfield", "wingers"]);
    expect(await loadV3Groups("wide")).toBeUndefined();
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
        // "Ukryj zawodników mojego klubu" was a checkbox before "Mój klub".
        myClub: "hide",
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
    expect(SCHEMA_VERSION.preferences).toBe(5);
    expect(await createScoutStore(backend).load()).toEqual({
      gameDb: Uint8Array.of(7),
      gameName: null,
      preferences: null,
      languages: {},
      careerSave: null,
      watchlist: [],
    });
  });

  describe("opening", () => {
    it("loads what the backend holds", async () => {
      const backend = memoryBackend();
      await createScoutStore(backend).saveGameDb(Uint8Array.of(7), "fifa.db");
      const onUnreadable = vi.fn<() => void>();
      const opened = await openScoutStore(backend, onUnreadable);
      expect(opened.stored.gameDb).toEqual(Uint8Array.of(7));
      expect(onUnreadable).not.toHaveBeenCalled();
    });

    it("reports a backend that cannot be read and works on, keeping nothing", async () => {
      const unreadable: StorageBackend = {
        get: () => Promise.reject(new Error("the store cannot be read")),
        set: () => Promise.reject(new Error("the store cannot be written")),
      };
      const onUnreadable = vi.fn<() => void>();
      const opened = await openScoutStore(unreadable, onUnreadable);
      expect(onUnreadable).toHaveBeenCalledOnce();
      expect(opened.stored.gameDb).toBeNull();
      await expect(
        opened.store.savePreferences({ filters: {}, sort: DEFAULT_SORT, showPotential: false }),
      ).resolves.toBeUndefined();
    });
  });
});
