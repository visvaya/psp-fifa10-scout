import { describe, expect, it } from "vitest";
import { initialNameOf } from "./player-names.ts";

describe("initialNameOf", () => {
  it("shortens the first name to its initial", () => {
    expect(initialNameOf("Lionel", "Messi")).toBe("L. Messi");
    // A first name of two words keeps the surname whole after its initial.
    expect(initialNameOf("Juan Román", "Riquelme")).toBe("J. Riquelme");
  });

  // Owner, 2026-11-14 (roadmap 125): fifa.db keeps "Renato Augusto" as a surname without a first name,
  // and a phone row cut it to "Renato …".
  it("shortens the first word of a name kept whole in the surname", () => {
    expect(initialNameOf("", "Renato Augusto")).toBe("R. Augusto");
    expect(initialNameOf("", "Zé Roberto da Silva")).toBe("Z. Roberto da Silva");
  });

  it("has nothing to shorten in a single word", () => {
    expect(initialNameOf("", "Ronaldinho")).toBeNull();
    expect(initialNameOf("Ronaldinho", "")).toBeNull();
  });
});
