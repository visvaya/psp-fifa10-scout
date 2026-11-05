import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_GROUPS,
  GROUP_STAT_KEYS,
  groupRange,
  groupStat,
  isGroupStatKey,
  isUnevenProfile,
} from "./attribute-groups.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { ATTRIBUTE_NAMES } from "./players.ts";
import { attributes } from "./test-support/player-fixtures.ts";

describe("attribute groups", () => {
  it("cover every attribute exactly once", () => {
    const listed = ATTRIBUTE_GROUPS.flatMap(([, names]) => names);
    expect([...listed].toSorted()).toEqual([...ATTRIBUTE_NAMES].toSorted());
  });

  it("average the group's attributes to one decimal", () => {
    const player = attributes(50, { marking: 71, tackling: 70 });
    expect(groupStat(player, "defendingAverage")).toBe(70.5);
    expect(groupStat(player, "physicalAverage")).toBe(50);
    // 1 + 2 + 2 + 2 + 2 over five attributes is 1,8
    const uneven = attributes(2, { acceleration: 1 });
    expect(groupStat(uneven, "physicalAverage")).toBe(1.8);
  });

  it("measure the spread as the strongest minus the weakest attribute", () => {
    const player = attributes(60, { finishing: 90, heading: 35 });
    expect(groupStat(player, "shootingSpread")).toBe(55);
    expect(groupRange(player, "shooting")).toEqual({ min: 35, max: 90 });
    expect(groupStat(attributes(60), "shootingSpread")).toBe(0);
  });

  it("mark an uneven profile from the group's threshold up, the threshold included", () => {
    const threshold = SCOUT_CONFIG.attributeGroupUnevenSpreadMin.defending;
    const at = attributes(50, { marking: 50 + threshold });
    const below = attributes(50, { marking: 49 + threshold });
    expect(isUnevenProfile(at, "defending")).toBe(true);
    expect(isUnevenProfile(below, "defending")).toBe(false);
  });

  it("have a key for every group's average and spread", () => {
    expect(GROUP_STAT_KEYS).toHaveLength(ATTRIBUTE_GROUPS.length * 2);
    expect(GROUP_STAT_KEYS.every(isGroupStatKey)).toBe(true);
    expect(isGroupStatKey("finishing")).toBe(false);
  });
});
