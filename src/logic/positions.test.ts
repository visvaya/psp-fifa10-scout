import { describe, expect, it } from "vitest";
import { positionOf } from "./positions.ts";

describe("positionOf", () => {
  it("names codes and groups them, rejecting codes outside 0..31", () => {
    expect(positionOf(0)).toEqual({ name: "GK", group: "goalkeeper" });
    expect(positionOf(31)).toEqual({ name: "LS", group: "forwards" });
    expect(() => positionOf(32)).toThrow(/Unknown position code 32/);
  });
});
