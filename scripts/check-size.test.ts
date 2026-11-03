import { describe, expect, it } from "vitest";
import { findSizeProblems } from "./check-size.ts";

const BUDGETS = { jsGzipBytes: 10, cssGzipBytes: 10, serviceWorkerBytes: 10, precacheBytes: 10 };

describe("findSizeProblems", () => {
  it("accepts sizes up to the budget", () => {
    expect(findSizeProblems(BUDGETS, BUDGETS)).toEqual([]);
  });

  it("names every size over its budget", () => {
    expect(findSizeProblems({ ...BUDGETS, cssGzipBytes: 11, precacheBytes: 12 }, BUDGETS)).toEqual([
      "cssGzipBytes: 11 exceeds the budget of 10",
      "precacheBytes: 12 exceeds the budget of 10",
    ]);
  });
});
