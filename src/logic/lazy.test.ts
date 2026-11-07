import { afterEach, describe, expect, it, vi } from "vitest";
import { lazy } from "./lazy.ts";

describe("lazy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes the value on the first call only and returns the same one after", () => {
    const make = vi.fn<() => object>(() => ({}));
    const value = lazy(make);
    expect(make).not.toHaveBeenCalled();
    const first = value();
    expect(value()).toBe(first);
    expect(make).toHaveBeenCalledOnce();
  });

  // Building a collator loads its locale data: a long task at the start of a slow phone.
  it("keeps loading the players module free of the Polish collator", async () => {
    const collator = vi.spyOn(Intl, "Collator");
    vi.resetModules();
    await import("./players.ts");
    expect(collator).not.toHaveBeenCalled();
  });
});
