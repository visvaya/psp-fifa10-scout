import { describe, expect, it } from "vitest";
import { phoneColumns } from "./phone-columns.ts";

describe("phoneColumns", () => {
  it("starts with OVR, and the potential when shown", () => {
    const base = { ratingCode: null, ratingPeakSet: false, ranges: {}, sortKey: "name" } as const;
    expect(phoneColumns({ ...base, showPotential: false })).toEqual(["overall"]);
    expect(phoneColumns({ ...base, showPotential: true })).toEqual(["overall", "potential"]);
  });

  it("adds the position rating with its gain, then the ranged values in the order they were added", () => {
    expect(
      phoneColumns({
        showPotential: true,
        ratingCode: 5,
        ratingPeakSet: false,
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

  it("adds the peak at the chosen position when ranged or sorted by, with potential shown", () => {
    const base = { showPotential: true, ratingCode: 5, ratingPeakSet: false, ranges: {} };
    const rated = ["overall", "potential", "positionRating", "ratingGain"];
    expect(phoneColumns({ ...base, sortKey: "name" })).toEqual(rated);
    expect(phoneColumns({ ...base, ratingPeakSet: true, sortKey: "name" })).toEqual([
      ...rated,
      "positionPeak",
    ]);
    expect(phoneColumns({ ...base, sortKey: "positionPeak" })).toEqual([...rated, "positionPeak"]);
    expect(
      phoneColumns({ ...base, showPotential: false, ratingPeakSet: true, sortKey: "name" }),
    ).toEqual(["overall", "positionRating", "ratingGain"]);
    expect(
      phoneColumns({ ...base, ratingCode: null, ratingPeakSet: true, sortKey: "positionPeak" }),
    ).toEqual(["overall", "potential"]);
  });

  it("adds a number it sorts by last, once, and nothing for text", () => {
    const base = {
      showPotential: false,
      ratingCode: null,
      ratingPeakSet: false,
      ranges: { stamina: { min: 50 } },
    };
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
        ratingPeakSet: false,
        ranges: { growth: { min: 5 } },
        sortKey: "potential",
      }),
    ).toEqual(["overall"]);
  });

  it("shows a group's average or spread as it does an attribute: ranged or sorted by", () => {
    const base = { showPotential: false, ratingCode: null, ratingPeakSet: false };
    expect(
      phoneColumns({
        ...base,
        ranges: { mentalAverage: { min: 60 }, stamina: { min: 50 } },
        sortKey: "goalkeepingSpread",
      }),
    ).toEqual(["overall", "mentalAverage", "stamina", "goalkeepingSpread"]);
  });
});
