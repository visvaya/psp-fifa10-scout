// The attribute groups of the player card, and what the screens derive from them: a group's average
// (to one decimal), its spread (strongest minus weakest attribute) and whether the profile is uneven.
// The averages and spreads are range, sort and column keys beside the attributes.
import { SCOUT_CONFIG } from "./config.ts";
import { ATTRIBUTE_NAMES, isAttributeName } from "./players.ts";
import type { AttributeName, Attributes, Player } from "./players.ts";

/** In the order the card shows them. */
export const ATTRIBUTE_GROUP_NAMES = [
  "physical",
  "technique",
  "shooting",
  "mental",
  "defending",
  "goalkeeping",
] as const;

export type AttributeGroup = (typeof ATTRIBUTE_GROUP_NAMES)[number];

export const GROUP_ATTRIBUTES: Readonly<Record<AttributeGroup, readonly AttributeName[]>> = {
  physical: ["acceleration", "sprintspeed", "stamina", "strength", "aggression"],
  technique: ["ballcontrol", "dribbling", "crossing", "shortpassing", "longpassing", "freekicks"],
  shooting: ["finishing", "shotpower", "longshotaccuracy", "heading"],
  mental: ["reactions", "positioning", "tacticalawareness", "playercomposure"],
  defending: ["marking", "tackling"],
  goalkeeping: ["gkdiving", "gkpositioning", "handling", "reflexes"],
};

export type GroupStatKey = `${AttributeGroup}${"Average" | "Spread"}`;

export const GROUP_STAT_KEYS: readonly GroupStatKey[] = ATTRIBUTE_GROUP_NAMES.flatMap((group) => [
  `${group}Average` as const,
  `${group}Spread` as const,
]);

/** The group of each key, and whether it is the average (shown with a decimal) or the spread (whole points). */
export const GROUP_STATS: Readonly<
  Record<GroupStatKey, { readonly group: AttributeGroup; readonly average: boolean }>
> = {
  physicalAverage: { group: "physical", average: true },
  physicalSpread: { group: "physical", average: false },
  techniqueAverage: { group: "technique", average: true },
  techniqueSpread: { group: "technique", average: false },
  shootingAverage: { group: "shooting", average: true },
  shootingSpread: { group: "shooting", average: false },
  mentalAverage: { group: "mental", average: true },
  mentalSpread: { group: "mental", average: false },
  defendingAverage: { group: "defending", average: true },
  defendingSpread: { group: "defending", average: false },
  goalkeepingAverage: { group: "goalkeeping", average: true },
  goalkeepingSpread: { group: "goalkeeping", average: false },
};

/** An attribute or a group's average or spread: what the attribute range filter offers. */
export type AttributeKey = AttributeName | GroupStatKey;
export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [...ATTRIBUTE_NAMES, ...GROUP_STAT_KEYS];

export const isGroupStatKey = (key: string): key is GroupStatKey =>
  GROUP_STAT_KEYS.some((candidate) => candidate === key);

export const isAttributeKey = (key: string): key is AttributeKey =>
  isAttributeName(key) || isGroupStatKey(key);

export const isGroupAverage = (key: string): boolean =>
  isGroupStatKey(key) && GROUP_STATS[key].average;

/** The weakest and the strongest attribute of the group. */
export const groupRange = (
  attributes: Attributes,
  group: AttributeGroup,
): { readonly min: number; readonly max: number } => {
  const values = GROUP_ATTRIBUTES[group].map((name) => attributes[name]);
  return { min: Math.min(...values), max: Math.max(...values) };
};

export const groupSpread = (attributes: Attributes, group: AttributeGroup): number => {
  const { min, max } = groupRange(attributes, group);
  return max - min;
};

export const groupAverage = (attributes: Attributes, group: AttributeGroup): number => {
  const names = GROUP_ATTRIBUTES[group];
  const sum = names.reduce((total, name) => total + attributes[name], 0);
  return Math.round((sum / names.length) * 10) / 10;
};

/** A group's average (one decimal) or spread (whole points). */
export const groupStat = (attributes: Attributes, key: GroupStatKey): number => {
  const { group, average } = GROUP_STATS[key];
  return average ? groupAverage(attributes, group) : groupSpread(attributes, group);
};

/**
 * The group describes the player's role and its spread reaches the group's threshold (the 80th
 * percentile among such players): the goalkeeping group for goalkeepers, the other five for outfield
 * players. The averages and spreads themselves exist for everyone.
 */
export const isUnevenProfile = (
  { attributes, positionGroup }: Pick<Player, "attributes" | "positionGroup">,
  group: AttributeGroup,
): boolean =>
  (group === "goalkeeping") === (positionGroup === "goalkeeper") &&
  groupSpread(attributes, group) >= SCOUT_CONFIG.attributeGroupUnevenSpreadMin[group];
