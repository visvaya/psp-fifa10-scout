import { describe, expect, it, vi } from "vitest";
import { lazy } from "./lazy.ts";

describe("lazy", () => {
  it("makes the value on the first call only and returns the same one after", () => {
    const make = vi.fn<() => object>(() => ({}));
    const value = lazy(make);
    expect(make).not.toHaveBeenCalled();
    const first = value();
    expect(value()).toBe(first);
    expect(make).toHaveBeenCalledOnce();
  });
});
