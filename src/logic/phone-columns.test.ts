import { describe, expect, it } from "vitest";
import { phoneColumns } from "./phone-columns.ts";

describe("phoneColumns", () => {
  it("starts with OVR, and the potential when shown", () => {
    const base = { ratingCode: null, ranges: {}, sortKey: "name" } as const;
    expect(phoneColumns({ ...base, showPotential: false })).toEqual(["overall"]);
    expect(phoneColumns({ ...base, showPotential: true })).toEqual(["overall", "potential"]);
  });

  it("adds the position rating with its gain, then the ranged values in the order they were added", () => {
    expect(
      phoneColumns({
        showPotential: true,
        ratingCode: 5,
        ranges: {
          sprintspeed: { min: 70 },
          age: { max: 23 },
          acceleration: {},
          overall: { min: 60 },
        },
        sortKey: "name",
      }),
    ).toEqual(["overall", "potential", "positionRating", "ratingGain", "sprintspeed", "age"]);
  });

  it("adds a number it sorts by last, once, and nothing for text", () => {
    const base = { showPotential: false, ratingCode: null, ranges: { stamina: { min: 50 } } };
    expect(phoneColumns({ ...base, sortKey: "dribbling" })).toEqual([
      "overall",
      "stamina",
      "dribbling",
    ]);
    expect(phoneColumns({ ...base, sortKey: "stamina" })).toEqual(["overall", "stamina"]);
    expect(phoneColumns({ ...base, sortKey: "clubName" })).toEqual(["overall", "stamina"]);
  });

  it("leaves the potential's values out while the potential is hidden", () => {
    expect(
      phoneColumns({
        showPotential: false,
        ratingCode: null,
        ranges: { growth: { min: 5 } },
        sortKey: "potential",
      }),
    ).toEqual(["overall"]);
  });
});
