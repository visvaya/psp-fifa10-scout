import { describe, expect, it } from "vitest";
import { attributesOf, searchKey } from "./players.ts";
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
