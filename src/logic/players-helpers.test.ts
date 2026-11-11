import { describe, expect, it, vi } from "vitest";
import { attributesOf } from "./attributes.ts";
import { searchKey } from "./player-names.ts";
import { playerRow } from "./test-support/player-fixtures.ts";

describe("searchKey", () => {
  it("drops case and diacritics, ł included", () => {
    expect(searchKey("Paweł ŻURAWSKI Łoś")).toBe("pawel zurawski los");
  });
});

describe("attributesOf", () => {
  it("rejects a players row without every attribute column", () => {
    const { reflexes: _, ...partial } = playerRow({});
    expect(() => attributesOf(partial)).toThrow(/lack attribute columns/);
  });
});

describe("loading the module", () => {
  // The Polish collator is costly to build (lazy.ts), and the start screen does not need it.
  it("builds no collator", async () => {
    const collator = vi.spyOn(Intl, "Collator");
    vi.resetModules();
    await import("./players.ts");
    expect(collator).not.toHaveBeenCalled();
    collator.mockRestore();
  });
});
