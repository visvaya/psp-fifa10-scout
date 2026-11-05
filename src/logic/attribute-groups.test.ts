import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_GROUP_NAMES,
  GROUP_ATTRIBUTES,
  GROUP_STAT_KEYS,
  groupAverage,
  groupRange,
  groupSpread,
  groupStat,
  isGroupAverage,
  isUnevenProfile,
} from "./attribute-groups.ts";
import { SCOUT_CONFIG } from "./config.ts";
import { ATTRIBUTE_NAMES } from "./players.ts";
import { attributes, testPlayer } from "./test-support/player-fixtures.ts";

describe("attribute groups", () => {
  it("cover every attribute exactly once", () => {
    const listed = ATTRIBUTE_GROUP_NAMES.flatMap((group) => GROUP_ATTRIBUTES[group]);
    expect([...listed].toSorted()).toEqual([...ATTRIBUTE_NAMES].toSorted());
  });

  it("average the group's attributes to one decimal", () => {
    const player = attributes(50, { marking: 71, tackling: 70 });
    expect(groupAverage(player, "defending")).toBe(70.5);
    expect(groupAverage(player, "physical")).toBe(50);
    // 1 + 2 + 2 + 2 + 2 over five attributes is 1,8
    expect(groupAverage(attributes(2, { acceleration: 1 }), "physical")).toBe(1.8);
  });

  it("measure the spread as the strongest minus the weakest attribute", () => {
    const player = attributes(60, { finishing: 90, heading: 35 });
    expect(groupSpread(player, "shooting")).toBe(55);
    expect(groupRange(player, "shooting")).toEqual({ min: 35, max: 90 });
    expect(groupSpread(attributes(60), "shooting")).toBe(0);
  });

  it("have a key for every group's average and spread, resolving to its value", () => {
    expect(GROUP_STAT_KEYS).toHaveLength(ATTRIBUTE_GROUP_NAMES.length * 2);
    const player = attributes(60, { finishing: 90, heading: 35 });
    expect(groupStat(player, "shootingSpread")).toBe(55);
    expect(groupStat(player, "shootingAverage")).toBe(61.3);
    expect(isGroupAverage("shootingAverage")).toBe(true);
    expect(isGroupAverage("shootingSpread")).toBe(false);
    expect(isGroupAverage("finishing")).toBe(false);
  });
});

const threshold = (group: "defending" | "goalkeeping") =>
  SCOUT_CONFIG.attributeGroupUnevenSpreadMin[group];

describe("isUnevenProfile", () => {
  it("marks a spread from the group's threshold up, the threshold included", () => {
    const at = testPlayer({ attributes: attributes(50, { marking: 50 + threshold("defending") }) });
    const below = testPlayer({
      attributes: attributes(50, { marking: 49 + threshold("defending") }),
    });
    expect(isUnevenProfile(at, "defending")).toBe(true);
    expect(isUnevenProfile(below, "defending")).toBe(false);
  });

  it("marks the goalkeeping group for goalkeepers only, the other groups for outfield players only", () => {
    const uneven = attributes(50, {
      reflexes: 50 + threshold("goalkeeping"),
      marking: 50 + threshold("defending"),
    });
    const keeper = testPlayer({ positionGroup: "goalkeeper", attributes: uneven });
    const outfield = testPlayer({ positionGroup: "wingers", attributes: uneven });
    expect(isUnevenProfile(keeper, "goalkeeping")).toBe(true);
    expect(isUnevenProfile(outfield, "goalkeeping")).toBe(false);
    expect(isUnevenProfile(outfield, "defending")).toBe(true);
    expect(isUnevenProfile(keeper, "defending")).toBe(false);
  });
});
