import { describe, expect, it } from "vitest";
import { effectiveColumns, isKeyAvailable, tableColumns } from "./columns.ts";
import { phoneColumns } from "./phone-columns.ts";

const TABLE = {
  ratingCode: null,
  showPotential: false,
  ranged: [],
  priced: false,
  projected: false,
} as const;
const PHONE = { ratingCode: null, ratingPeakSet: false, ranges: {}, sortKey: "name" } as const;
const PLAIN = { showPotential: false, ratingCode: null, career: false } as const;

describe("tableColumns", () => {
  it("lists the lead columns, OVR, the details and the standard attributes", () => {
    expect(tableColumns(TABLE)).toEqual([
      "name",
      "age",
      "positionCode",
      "overall",
      "clubName",
      "leagueName",
      "nationalityName",
      "contractEndYear",
      "sprintspeed",
      "dribbling",
      "shortpassing",
      "finishing",
      "tackling",
      "reactions",
    ]);
  });

  it("adds the position rating, potential and peaks, ranged attributes first, and the price", () => {
    const columns = tableColumns({
      ratingCode: 5,
      showPotential: true,
      ranged: ["dribbling"],
      priced: true,
      projected: true,
    });
    expect(columns.slice(0, 12)).toEqual([
      "name",
      "age",
      "positionCode",
      "overall",
      "positionRating",
      "ratingGain",
      "positionPeak",
      "potential",
      "peak",
      "dribbling",
      "clubName",
      "leagueName",
    ]);
    expect(columns).toContain("price");
    expect(columns.filter((column) => column === "dribbling")).toHaveLength(1);
  });
});

describe("effectiveColumns", () => {
  it("is the automatic columns when nothing is overridden", () => {
    const automatic = tableColumns(TABLE);
    expect(effectiveColumns(automatic, undefined, PLAIN)).toEqual(automatic);
    expect(effectiveColumns(automatic, {}, PLAIN)).toEqual(automatic);
  });

  it("hides a column in the table and shows one the automatic choice leaves out", () => {
    const columns = effectiveColumns(
      tableColumns({ ...TABLE, ranged: ["dribbling"] }),
      { dribbling: "hidden", height: "shown", weight: "shown" },
      PLAIN,
    );
    expect(columns).not.toContain("dribbling");
    // Shown ones follow the automatic columns, in the order they were turned on.
    expect(columns.slice(-2)).toEqual(["height", "weight"]);
    expect(columns).toContain("sprintspeed");
  });

  it("does the same for the phone rows, which never carry the name", () => {
    const automatic = phoneColumns({
      ...PHONE,
      showPotential: false,
      ranges: { sprintspeed: { min: 70 } },
    });
    expect(automatic).toEqual(["overall", "sprintspeed"]);
    expect(
      effectiveColumns(
        automatic,
        { sprintspeed: "hidden", clubName: "shown", age: "shown" },
        PLAIN,
      ),
    ).toEqual(["overall", "clubName", "age"]);
  });

  it("keeps the name, whatever is stored for it", () => {
    const automatic = tableColumns(TABLE);
    expect(effectiveColumns(automatic, { name: "hidden" }, PLAIN)[0]).toBe("name");
    expect(effectiveColumns(["overall"], { name: "shown" }, PLAIN)).toEqual(["overall"]);
  });

  it("leaves out the potential's values while the potential is hidden", () => {
    const overrides = { potential: "shown", peak: "shown", growth: "shown" } as const;
    expect(effectiveColumns(["overall"], overrides, PLAIN)).toEqual(["overall"]);
    expect(
      effectiveColumns(["overall"], overrides, { ...PLAIN, showPotential: true, career: true }),
    ).toEqual(["overall", "potential", "peak", "growth"]);
  });

  it("shows the position rating's columns only with a chosen position, and a career's only in one", () => {
    const overrides = { ratingGain: "shown", price: "shown", form: "shown" } as const;
    expect(effectiveColumns(["overall"], overrides, PLAIN)).toEqual(["overall"]);
    expect(effectiveColumns(["overall"], overrides, { ...PLAIN, ratingCode: 5 })).toEqual([
      "overall",
      "ratingGain",
    ]);
    expect(effectiveColumns(["overall"], overrides, { ...PLAIN, career: true })).toEqual([
      "overall",
      "price",
      "form",
    ]);
  });
});

describe("isKeyAvailable", () => {
  it("offers a career's values only with a career", () => {
    for (const key of ["price", "wage", "form", "morale", "injuryDays", "goals"] as const) {
      expect(isKeyAvailable(key, PLAIN)).toBe(false);
      expect(isKeyAvailable(key, { ...PLAIN, career: true })).toBe(true);
    }
  });

  it("offers the potential's values only while the potential shows, and a career's peak only in one", () => {
    expect(isKeyAvailable("potential", PLAIN)).toBe(false);
    expect(isKeyAvailable("potential", { ...PLAIN, showPotential: true })).toBe(true);
    expect(isKeyAvailable("peak", { ...PLAIN, showPotential: true })).toBe(false);
    expect(isKeyAvailable("peak", { ...PLAIN, showPotential: true, career: true })).toBe(true);
  });

  it("offers the position rating's values only with a chosen position", () => {
    expect(isKeyAvailable("positionRating", PLAIN)).toBe(false);
    expect(isKeyAvailable("positionRating", { ...PLAIN, ratingCode: 5 })).toBe(true);
    const all = { showPotential: true, ratingCode: 5, career: true };
    expect(isKeyAvailable("positionPeak", { ...all, career: false })).toBe(false);
    expect(isKeyAvailable("positionPeak", all)).toBe(true);
  });

  it("always offers the game's own values", () => {
    expect(isKeyAvailable("name", PLAIN)).toBe(true);
    expect(isKeyAvailable("overall", PLAIN)).toBe(true);
  });
});
