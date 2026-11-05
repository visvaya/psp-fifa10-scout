// The attribute groups of the player card, and what the screens derive from them: a group's average
// (to one decimal), its spread (strongest minus weakest attribute) and whether the profile is uneven.
// The averages and spreads are range, sort and column keys beside the attributes.
import { SCOUT_CONFIG } from "./config.ts";
import { ATTRIBUTE_NAMES, isAttributeName } from "./players.ts";
import type { AttributeName, Attributes } from "./players.ts";

export const ATTRIBUTE_GROUPS = [
  ["physical", ["acceleration", "sprintspeed", "stamina", "strength", "aggression"]],
  [
    "technique",
    ["ballcontrol", "dribbling", "crossing", "shortpassing", "longpassing", "freekicks"],
  ],
  ["shooting", ["finishing", "shotpower", "longshotaccuracy", "heading"]],
  ["mental", ["reactions", "positioning", "tacticalawareness", "playercomposure"]],
  ["defending", ["marking", "tackling"]],
  ["goalkeeping", ["gkdiving", "gkpositioning", "handling", "reflexes"]],
] as const satisfies readonly (readonly [string, readonly AttributeName[]])[];

export type AttributeGroup = (typeof ATTRIBUTE_GROUPS)[number][0];
export type GroupStatKey = `${AttributeGroup}${"Average" | "Spread"}`;

export const GROUP_STAT_KEYS: readonly GroupStatKey[] = ATTRIBUTE_GROUPS.flatMap(([group]) => [
  `${group}Average` as const,
  `${group}Spread` as const,
]);

/** An attribute or a group's average or spread: what the attribute range filter offers. */
export type AttributeKey = AttributeName | GroupStatKey;
export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [...ATTRIBUTE_NAMES, ...GROUP_STAT_KEYS];

export const isGroupStatKey = (key: string): key is GroupStatKey =>
  GROUP_STAT_KEYS.some((candidate) => candidate === key);

export const isAttributeKey = (key: string): key is AttributeKey =>
  isAttributeName(key) || isGroupStatKey(key);

/** A group average (shown with a decimal), whatever the key: a spread and the attributes are whole numbers. */
export const isGroupAverage = (key: string): boolean => key.endsWith("Average");

const attributesOfGroup = (group: AttributeGroup): readonly AttributeName[] =>
  ATTRIBUTE_GROUPS.find(([name]) => name === group)?.[1] ?? [];

/** The weakest and the strongest attribute of the group. */
export const groupRange = (
  attributes: Attributes,
  group: AttributeGroup,
): { readonly min: number; readonly max: number } => {
  const values = attributesOfGroup(group).map((name) => attributes[name]);
  return { min: Math.min(...values), max: Math.max(...values) };
};

const groupAverage = (attributes: Attributes, group: AttributeGroup): number => {
  const names = attributesOfGroup(group);
  const sum = names.reduce((total, name) => total + attributes[name], 0);
  return Math.round((sum / names.length) * 10) / 10;
};

/** A group's average (one decimal) or spread (whole points). */
export const groupStat = (attributes: Attributes, key: GroupStatKey): number => {
  const group = ATTRIBUTE_GROUPS.find(([name]) => key.startsWith(name))?.[0] ?? "physical";
  if (isGroupAverage(key)) return groupAverage(attributes, group);
  const { min, max } = groupRange(attributes, group);
  return max - min;
};

/** The group's spread reaches its threshold (the 80th percentile of the game's players). */
export const isUnevenProfile = (attributes: Attributes, group: AttributeGroup): boolean => {
  const { min, max } = groupRange(attributes, group);
  return max - min >= SCOUT_CONFIG.attributeGroupUnevenSpreadMin[group];
};
