import { describe, expect, it } from "vitest";
import { DEFAULT_SORT } from "./scout-state.ts";
import type { Preferences } from "./scout-state.ts";
import { createScoutStore, memoryBackend, SCHEMA_VERSION } from "./scout-store.ts";

const loadColumns = async (columns: unknown) => {
  const backend = memoryBackend();
  await backend.set("preferences", {
    schemaVersion: SCHEMA_VERSION.preferences,
    value: { filters: {}, sort: DEFAULT_SORT, columns },
  });
  return (await createScoutStore(backend).load()).preferences;
};

describe("stored column visibility", () => {
  it("saves and loads the overrides in the order they were made", async () => {
    const store = createScoutStore(memoryBackend());
    const preferences: Preferences = {
      filters: {},
      sort: DEFAULT_SORT,
      showPotential: false,
      columns: { weight: "shown", dribbling: "hidden", clubName: "shown" },
    };
    await store.savePreferences(preferences);
    const loaded = (await store.load()).preferences;
    expect(loaded?.columns).toEqual(preferences.columns);
    expect(Object.keys(loaded?.columns ?? {})).toEqual(["weight", "dribbling", "clubName"]);
  });

  it("drops unknown keys and values one by one", async () => {
    const loaded = await loadColumns({
      clubName: "shown",
      nonsense: "shown",
      dribbling: "visible",
      height: 1,
      weight: "hidden",
    });
    expect(loaded?.columns).toEqual({ clubName: "shown", weight: "hidden" });
  });

  it("loads a record without the field, or with nothing valid in it, as no overrides", async () => {
    const backend = memoryBackend();
    await backend.set("preferences", {
      schemaVersion: SCHEMA_VERSION.preferences,
      value: { filters: {}, sort: DEFAULT_SORT },
    });
    const old = (await createScoutStore(backend).load()).preferences;
    expect(old).not.toBeNull();
    expect(old).not.toHaveProperty("columns");
    expect(await loadColumns({ nonsense: "shown" })).not.toHaveProperty("columns");
    expect(await loadColumns("shown")).not.toHaveProperty("columns");
  });
});
